import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  Alert,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
// Conditional import for Voice - native module not available in Expo Go
let Voice: any = null;
try {
  Voice = require('@react-native-voice/voice').default;
} catch (e) {
  console.log('[ChatScreen] Voice native module not available - using Expo Go');
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speakWithFriday } from '@/services/voice';
import { recordAndTranscribe } from '@/services/voiceInput';
import {
  saveConversationRecord,
  getAllSessions,
  resumeSession,
  ConversationSession,
} from '@/services/fridayHistory';
import { fetchOllamaModels } from '@/services/ollamaModels';
import { useFriday } from '@/hooks/useFriday';
import { supabase } from '@/lib/supabase';
import {
  createSession as createSupabaseSession,
  saveMessage,
  updateSessionTitle,
  autoGenerateTitle,
  loadSessionMessages,
} from '@/lib/conversationService';
import { Colors } from '@/constants/theme';
import { UserProfile, DEFAULT_USER_PROFILE } from '@/constants/onboarding';
import { getGreeting, formatDate } from '@/lib/greetings';
import { TypingIndicator } from '@/components/TypingIndicator';
import { WaveformIcon } from '@/components/WaveformIcon';
import { AvatarDropdown } from '@/components/AvatarDropdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  fileName?: string;
  fileContent?: string;
}

const DEFAULT_MODEL = 'llama3.3:70b';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<'elevenlabs' | 'moira'>('elevenlabs');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceConversation, setIsVoiceConversation] = useState(false);
  const [voiceConversationStatus, setVoiceConversationStatus] = useState<'listening' | 'thinking' | 'speaking' | null>(null);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceConversationRef = useRef(false);
  const [session, setSession] = useState<any>(null);
  const [authSession, setAuthSession] = useState<any>(null);

  // Friday AI Assistant integration with dynamic user settings
  const friday = useFriday({
    enabled: true,
    ollamaEndpoint: 'http://192.168.1.219:11434',
    ollamaModel: selectedModel,
    userSettings: {
      name: userProfile.name || 'Friend',
      preferences: { theme: 'dark', language: 'en' },
      timezone: userProfile.timezone,
    },
  });

  // Animations
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const voicePulseAnim = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const dot4Anim = useRef(new Animated.Value(0)).current;
  const dot5Anim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const modalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect if a model supports vision
  const isVisionModel = (modelName: string): boolean => {
    const lowerName = modelName.toLowerCase();
    return (
      lowerName.includes('vision') ||
      lowerName.includes('llava') ||
      lowerName.includes('moondream') ||
      lowerName.includes('qwen-vl') ||
      lowerName.includes('minicpm-v') ||
      lowerName.includes('qwen2-vl')
    );
  };

  // Find available vision models
  const findVisionModels = (): any[] => {
    return availableModels.filter(model => isVisionModel(model.model || ''));
  };

  // Load models from Ollama
  const loadModels = useCallback(async () => {
    console.log('[ChatScreen] Fetching available models from Ollama...');
    const models = await fetchOllamaModels();
    setAvailableModels(models);
    if (models.length > 0) {
      console.log('[ChatScreen] Found', models.length, 'models');
      // Set first model as default if it exists
      const firstModelName = models[0]?.model || DEFAULT_MODEL;
      setSelectedModel(firstModelName);
      await AsyncStorage.setItem('selectedModel', firstModelName);
    } else {
      console.log('[ChatScreen] No models found, using default');
    }
  }, []);

  // Check Ollama server status
  const checkServerStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('http://192.168.1.219:11434/api/tags', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setServerStatus(response.ok ? 'online' : 'offline');
    } catch {
      setServerStatus('offline');
    }
  }, []);

  // Load settings from async storage
  const loadSettings = useCallback(async () => {
    try {
      const [model, speak, engine, muted, profileJson] = await Promise.all([
        AsyncStorage.getItem('selectedModel'),
        AsyncStorage.getItem('autoSpeak'),
        AsyncStorage.getItem('voiceEngine'),
        AsyncStorage.getItem('isMuted'),
        AsyncStorage.getItem('userProfile'),
      ]);
      if (model) setSelectedModel(model);
      if (speak !== null) setAutoSpeak(speak === 'true');
      if (engine === 'moira') {
        setVoiceEngine('moira');
      } else {
        setVoiceEngine('elevenlabs');
      }
      if (muted !== null) setIsMuted(muted === 'true');
      if (profileJson) {
        try {
          const profile = JSON.parse(profileJson);
          setUserProfile(profile);
          console.log('[ChatScreen] Loaded user profile:', profile.name);
        } catch (e) {
          console.error('Error parsing user profile:', e);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Initialize Voice Recognition (guarded for Expo Go)
  useEffect(() => {
    if (!Voice) return;

    Voice.onSpeechStart = () => {
      console.log('[ChatScreen] Voice recognition started');
      setIsVoiceListening(true);
      if (isVoiceConversation) {
        setVoiceConversationStatus('listening');
      }
    };

    Voice.onSpeechRecognized = () => {
      console.log('[ChatScreen] Voice recognized');
    };

    Voice.onSpeechEnd = () => {
      console.log('[ChatScreen] Voice recognition ended');
      setIsVoiceListening(false);

      // In voice conversation mode, wait for silence threshold before sending
      if (isVoiceConversation) {
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
        silenceTimeoutRef.current = setTimeout(() => {
          console.log('[ChatScreen] Silence detected, auto-sending message');
          // Auto-send will be handled in the UI
        }, 1500); // 1.5 second silence threshold
      }
    };

    Voice.onSpeechError = (error: any) => {
      console.error('[ChatScreen] Voice error:', error);
      setIsVoiceListening(false);
    };

    Voice.onSpeechResults = (result: any) => {
      if (result.value && result.value[0]) {
        const transcript = result.value[0];
        console.log('[ChatScreen] Transcript:', transcript);
        setVoiceTranscript(transcript);
        setInput(transcript);
      }
    };

    return () => {
      if (Voice) {
        Voice.destroy().catch(() => {});
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
    };
  }, [isVoiceConversation]);

  // Voice microphone pulse animation
  useEffect(() => {
    if (isVoiceListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(voicePulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(voicePulseAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      voicePulseAnim.setValue(0);
    }
  }, [isVoiceListening, voicePulseAnim]);

  // Load session from Supabase
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      setSession(sess);
      setAuthSession(sess);
    };
    loadSession();
  }, []);

  // Load messages when session ID changes
  useEffect(() => {
    const loadPreviousMessages = async () => {
      if (currentSessionId && currentSessionId !== '') {
        try {
          const previousMessages = await loadSessionMessages(currentSessionId);
          // Convert Supabase messages to Message format
          const formattedMessages: Message[] = previousMessages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            imageBase64: msg.imageBase64,
            fileName: msg.fileName,
            fileContent: msg.fileContent,
          }));
          setMessages(formattedMessages);
          console.log('[ChatScreen] Loaded', formattedMessages.length, 'messages from session', currentSessionId);
        } catch (err) {
          console.error('[ChatScreen] Failed to load session messages:', err);
        }
      }
    };
    loadPreviousMessages();
  }, [currentSessionId]);

  // Load settings, create session, check server, and fetch models on mount
  useEffect(() => {
    const initializeChat = async () => {
      await loadSettings();

      // Fallback: if no profile name, get it from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (user && (!userProfile.name || userProfile.name === '')) {
        const name = user.user_metadata?.name ||
                     user.email?.split('@')[0] ||
                     'User';
        setUserProfile(prev => ({ ...prev, name }));
        console.log('[ChatScreen] Loaded user name from Supabase:', name);
      }

      loadModels();
      initializeSession();
      checkServerStatus();
    };

    initializeChat();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [loadSettings, loadModels, checkServerStatus, userProfile.name]);

  // KITT-style scanner animation
  useEffect(() => {
    if (serverStatus === 'online') {
      Animated.stagger(100, [
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot1Anim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(dot1Anim, { toValue: 0, duration: 200, useNativeDriver: false }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot2Anim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(dot2Anim, { toValue: 0, duration: 200, useNativeDriver: false }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot3Anim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(dot3Anim, { toValue: 0, duration: 200, useNativeDriver: false }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot4Anim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(dot4Anim, { toValue: 0, duration: 200, useNativeDriver: false }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot5Anim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(dot5Anim, { toValue: 0, duration: 200, useNativeDriver: false }),
          ])
        ),
      ]).start();
    }
  }, [serverStatus, dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  // Pulse animation for voice mode FAB
  useEffect(() => {
    if (voiceMode) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [voiceMode, pulseAnim]);

  // Auto-close modal after 60 seconds
  useEffect(() => {
    if (voiceMode) {
      if (modalTimeoutRef.current) {
        clearTimeout(modalTimeoutRef.current);
      }
      modalTimeoutRef.current = setTimeout(() => {
        setVoiceMode(false);
        setVoiceInput('');
      }, 60000);
    } else {
      if (modalTimeoutRef.current) {
        clearTimeout(modalTimeoutRef.current);
      }
    }
    return () => {
      if (modalTimeoutRef.current) {
        clearTimeout(modalTimeoutRef.current);
      }
    };
  }, [voiceMode]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const initializeSession = async () => {
    try {
      if (!authSession?.user.id) {
        console.error('No authenticated user for session creation');
        return;
      }
      const newSession = await createSupabaseSession(authSession.user.id, 'New Conversation');
      setCurrentSessionId(newSession.id);
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const allSessions = await getAllSessions();
      setSessions(allSessions.sort((a, b) => b.startedAt - a.startedAt));
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const speakText = async (text: string) => {
    if (isMuted) return;
    setIsSpeaking(true);
    if (isVoiceConversation) {
      setVoiceConversationStatus('speaking');
    }
    try {
      if (voiceEngine === 'elevenlabs') {
        await speakWithFriday(text);
      } else {
        await Speech.speak(text, {
          language: 'en-IE',
          pitch: 1.15,
          rate: 0.90,
        } as any);
      }
    } catch (error) {
      console.error('Speech error:', error);
    } finally {
      setIsSpeaking(false);
      // In voice conversation mode, auto-listen after speaking
      if (isVoiceConversation && Voice) {
        try {
          setVoiceConversationStatus('listening');
          await Voice.start('en-US');
          console.log('[ChatScreen] Auto-listening after speech');
        } catch (error) {
          console.error('[ChatScreen] Error auto-listening:', error);
        }
      }
    }
  };

  const handleMuteToggle = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem('isMuted', newMuted.toString());
  };

  const handleMicrophoneToggle = async () => {
    if (!Voice) {
      Alert.alert(
        'Voice Not Available',
        'Voice recognition requires a development build. The EAS build is in progress. For now, use text input or wait for the dev build to complete.'
      );
      return;
    }

    // Toggle voice conversation mode
    if (isVoiceConversation) {
      // Exit voice conversation mode
      setIsVoiceConversation(false);
      setVoiceConversationStatus(null);
      voiceConversationRef.current = false;
      setVoiceTranscript('');
      setInput('');
      if (isVoiceListening) {
        try {
          await Voice.stop();
          console.log('[ChatScreen] Exited voice conversation mode');
        } catch (error) {
          console.error('[ChatScreen] Error stopping voice:', error);
        }
      }
    } else {
      // Enter voice conversation mode
      try {
        setIsVoiceConversation(true);
        voiceConversationRef.current = true;
        setVoiceTranscript('');
        setInput('');
        setVoiceConversationStatus('listening');
        await Voice.start('en-US');
        console.log('[ChatScreen] Entered voice conversation mode');
      } catch (error) {
        console.error('[ChatScreen] Error starting voice conversation:', error);
        setIsVoiceConversation(false);
        voiceConversationRef.current = false;
        Alert.alert('Voice Input Error', 'Could not start voice recognition');
      }
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({
          uri: asset.uri,
          base64: asset.base64 || '',
        });
        setShowAttachmentMenu(false);
        console.log('[ChatScreen] Photo taken');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error('[ChatScreen] Camera error:', error);
    }
  };

  const handleChooseImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachedImage({
          uri: asset.uri,
          base64: asset.base64 || '',
        });
        setShowAttachmentMenu(false);
        console.log('[ChatScreen] Image selected');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
      console.error('[ChatScreen] Image picker error:', error);
    }
  };

  const handleImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/msword'],
      });

      if (!result.canceled && 'name' in result && 'uri' in result && result.name && typeof result.uri === 'string') {
        // Read file contents
        const response = await fetch(result.uri);
        const text = await response.text();
        setAttachedFile({
          name: result.name as string,
          content: text,
        });
        setShowAttachmentMenu(false);
        console.log('[ChatScreen] File imported:', result.name);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to import file');
      console.error('[ChatScreen] Document picker error:', error);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.trim()) {
        setAttachedFile({
          name: 'clipboard.txt',
          content: text,
        });
        setShowAttachmentMenu(false);
        console.log('[ChatScreen] Pasted from clipboard');
      } else {
        Alert.alert('Empty', 'Clipboard is empty');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to paste from clipboard');
      console.error('[ChatScreen] Clipboard error:', error);
    }
  };

  const handleVoiceModeToggle = () => {
    const newMode = !voiceMode;
    setVoiceMode(newMode);
    if (newMode) {
      Keyboard.dismiss();
    } else {
      setVoiceInput('');
    }
  };

  const handleVoiceInputSubmit = async () => {
    if (!voiceInput.trim()) return;
    const message = voiceInput;
    setVoiceInput('');
    await handleSendMessage(message);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await handleSendMessage(input);
  };

  const handleSendMessage = async (message: string) => {
    // Check if image is attached and model supports vision
    let finalModel = selectedModel;
    if (attachedImage && !isVisionModel(selectedModel)) {
      const visionModels = findVisionModels();
      if (visionModels.length > 0) {
        finalModel = visionModels[0].model;
        console.log('[ChatScreen] Switching to vision model:', finalModel);
        setSelectedModel(finalModel);
        await AsyncStorage.setItem('selectedModel', finalModel);
      } else {
        // No vision model available - show instructions
        Alert.alert(
          'Vision Model Not Found',
          'To enable image recognition, you need to pull a vision model on KNIGHTSWATCH.\n\nRun this command on KNIGHTSWATCH:\n\nollama pull llava\n\nSupported vision models:\n• llava\n• llava-llama3\n• llava-phi3\n• moondream\n• minicpm-v\n• qwen2-vl',
          [
            {
              text: 'Cancel',
              onPress: () => {
                setAttachedImage(null);
              },
              style: 'cancel',
            },
            {
              text: 'Try Again',
              onPress: () => {
                // User can try again after pulling model
              },
            },
          ]
        );
        setAttachedImage(null);
        setAttachedFile(null);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      ...(attachedImage && { imageBase64: attachedImage.base64 }),
      ...(attachedFile && { fileName: attachedFile.name, fileContent: attachedFile.content }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setVoiceTranscript('');
    setAttachedImage(null);
    setAttachedFile(null);
    setLoading(true);
    if (isVoiceConversation) {
      setVoiceConversationStatus('thinking');
    }
    const startTime = Date.now();

    try {
      console.log('[ChatScreen] Sending message to Friday:', message);
      if (attachedImage) {
        console.log('[ChatScreen] Including image attachment');
      }

      // Build the message content for Ollama API
      let messageContent = message;
      if (attachedFile) {
        // Include file content in message
        messageContent = `${message}\n\n[File: ${attachedFile.name}]\n${attachedFile.content}`;
      }

      // Send message directly to Friday (which talks to Ollama)
      // If image is attached, pass it to the Friday hook
      const response = attachedImage
        ? await friday.sendMessageWithImage(messageContent, attachedImage.base64)
        : await friday.sendMessage(messageContent);
      const duration = Date.now() - startTime;

      console.log('[ChatScreen] Got response from Friday:', response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save to Supabase and local history
      if (currentSessionId && authSession?.user.id) {
        try {
          // Save user message to Supabase
          await saveMessage(currentSessionId, authSession.user.id, {
            id: userMessage.id,
            role: 'user',
            content: message,
            imageBase64: userMessage.imageBase64,
            fileName: userMessage.fileName,
            fileContent: userMessage.fileContent,
            created_at: new Date().toISOString(),
          });

          // Save assistant message to Supabase
          await saveMessage(currentSessionId, authSession.user.id, {
            id: assistantMessage.id,
            role: 'assistant',
            content: response,
            created_at: new Date().toISOString(),
          });

          // Auto-generate title from first message
          if (messages.length === 0) {
            const title = autoGenerateTitle(message);
            await updateSessionTitle(currentSessionId, title);
            console.log('[ChatScreen] Auto-generated session title:', title);
          }

          console.log('[ChatScreen] Saved messages to Supabase session', currentSessionId);
        } catch (err) {
          console.error('[ChatScreen] Failed to save to Supabase:', err);
        }

        // Also save to local history for backwards compatibility
        await saveConversationRecord(currentSessionId, {
          timestamp: Date.now(),
          userMessage: message,
          fridayResponse: response,
          duration,
        });
      }

      // Auto-speak in voice conversation mode, or if autoSpeak is enabled
      if (isVoiceConversation || autoSpeak) {
        await speakText(response);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ChatScreen] Error sending message:', errorMsg);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
      };
      setMessages((prev) => [...prev, errorMessage]);

      // Save error to Supabase and local history
      if (currentSessionId && authSession?.user.id) {
        try {
          // Save user message to Supabase
          await saveMessage(currentSessionId, authSession.user.id, {
            id: userMessage.id,
            role: 'user',
            content: message,
            created_at: new Date().toISOString(),
          });

          // Save error message to Supabase
          await saveMessage(currentSessionId, authSession.user.id, {
            id: errorMessage.id,
            role: 'assistant',
            content: `Error: ${errorMsg}`,
            created_at: new Date().toISOString(),
          });

          console.log('[ChatScreen] Saved error messages to Supabase');
        } catch (err) {
          console.error('[ChatScreen] Failed to save error to Supabase:', err);
        }

        // Also save to local history
        await saveConversationRecord(currentSessionId, {
          timestamp: Date.now(),
          userMessage: message,
          fridayResponse: `Error: ${errorMsg}`,
          duration,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceRecord = async () => {
    setIsRecording(true);
    try {
      const transcribedText = await recordAndTranscribe();
      if (transcribedText) {
        setVoiceInput((prev) => (prev ? prev + ' ' + transcribedText : transcribedText));
      } else {
        Alert.alert(
          'Voice Input Not Available',
          'Speech recognition requires building with native modules.\n\nTo enable: expo prebuild\n\nFor now, use text mode to type your message.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Recording Failed',
        error instanceof Error ? error.message : 'Could not record audio'
      );
    } finally {
      setIsRecording(false);
    }
  };

  const handleOpenHistory = async () => {
    await loadSessions();
    setShowHistoryModal(true);
  };

  const handleResumeSession = async (sessionId: string) => {
    try {
      const pastMessages = await resumeSession(sessionId);
      setMessages(
        pastMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
      setShowHistoryModal(false);
      // Create a new session for continuing the conversation
      if (authSession?.user.id) {
        const newSession = await createSupabaseSession(authSession.user.id, 'New Conversation');
        setCurrentSessionId(newSession.id);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load session');
      console.error('Error resuming session:', error);
    }
  };

  const formatSessionDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Minimal Top Bar with Conversation Title */}
        <View style={[styles.minimalHeader, { paddingTop: insets.top + 4 }]}>
          <Text style={styles.conversationTitle}>New conversation ↓</Text>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.length === 0 && !loading && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>🤖</Text>
              <Text style={styles.emptyStateTitle}>F.R.I.D.A.Y. Online</Text>
              <Text style={styles.emptyStateText}>
                Initialize a conversation to get started
              </Text>
              <View style={styles.emptyStateHint}>
                <Text style={styles.emptyStateHintText}>
                  Ask a question, request analysis, or have a discussion
                </Text>
              </View>
            </View>
          )}
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageRow,
                message.role === 'user' ? styles.userRow : styles.assistantRow,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                {message.imageBase64 && (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${message.imageBase64}` }}
                    style={styles.messageBubbleImage}
                  />
                )}
                {message.fileName && (
                  <View style={styles.fileAttachment}>
                    <Text style={styles.fileIcon}>📄</Text>
                    <Text style={styles.fileName}>{message.fileName}</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' ? styles.userText : styles.assistantText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={styles.assistantRow}>
              <View style={styles.typingBubble}>
                <TypingIndicator />
              </View>
            </View>
          )}
          {friday.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorText}>{friday.error.message}</Text>
            </View>
          )}
          {isSpeaking && !loading && (
            <View style={styles.speakingContainer}>
              <Text style={styles.speakingIcon}>♪</Text>
              <Text style={styles.speakingText}>Friday is speaking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Attachment Preview */}
        {(attachedImage || attachedFile) && (
          <View style={styles.attachmentPreviewContainer}>
            {attachedImage && (
              <View style={styles.attachmentPreview}>
                <Image
                  source={{ uri: attachedImage.uri }}
                  style={styles.attachmentThumbnail}
                />
                <TouchableOpacity
                  style={styles.removeAttachmentButton}
                  onPress={() => setAttachedImage(null)}
                >
                  <Text style={styles.removeAttachmentIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            {attachedFile && (
              <View style={styles.filePreview}>
                <Text style={styles.filePreviewIcon}>📄</Text>
                <Text style={styles.filePreviewName}>{attachedFile.name}</Text>
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => setAttachedFile(null)}
                >
                  <Text style={styles.removeFileIcon}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Voice Conversation Mode Indicator */}
        {isVoiceConversation && (
          <View style={styles.voiceConversationIndicator}>
            <View style={styles.voiceStatusContainer}>
              {voiceConversationStatus === 'listening' && (
                <Animated.View
                  style={{
                    opacity: voicePulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  }}
                >
                  <Text style={styles.voiceStatusText}>🎤 Listening...</Text>
                </Animated.View>
              )}
              {voiceConversationStatus === 'thinking' && (
                <Text style={styles.voiceStatusText}>💭 Thinking...</Text>
              )}
              {voiceConversationStatus === 'speaking' && (
                <Text style={styles.voiceStatusText}>🔊 Speaking...</Text>
              )}
            </View>
          </View>
        )}

        {/* Copilot-style Input Bar */}
        <View style={[styles.inputContainer, isVoiceConversation && styles.inputContainerHidden]}>
          <View style={styles.inputBox}>
            {/* Attachment button */}
            <TouchableOpacity
              style={styles.plusButton}
              onPress={() => setShowAttachmentMenu(true)}
            >
              <Text style={styles.plusButtonText}>+</Text>
            </TouchableOpacity>

            {/* Text input */}
            <TextInput
              style={styles.textInput}
              placeholder={isVoiceConversation ? "Listening..." : "Type your message..."}
              placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              editable={!loading && !isVoiceConversation}
            />

            {/* Right side: Waveform or Send Arrow */}
            {input.trim() === '' && !isVoiceConversation ? (
              <TouchableOpacity
                style={styles.waveformButton}
                onPress={handleMicrophoneToggle}
                disabled={!Voice}
              >
                <WaveformIcon isActive={false} size={20} />
              </TouchableOpacity>
            ) : input.trim() === '' && isVoiceConversation ? (
              <TouchableOpacity
                style={styles.waveformButton}
                onPress={handleMicrophoneToggle}
              >
                <WaveformIcon isActive={true} size={20} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.sendArrowButton, !input.trim() && styles.sendArrowButtonDisabled]}
                onPress={handleSend}
                disabled={loading || !input.trim()}
              >
                <Text style={styles.sendArrowText}>↑</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Attachment Menu Modal */}
        <Modal
          visible={showAttachmentMenu}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAttachmentMenu(false)}
        >
          <View style={styles.attachmentMenuOverlay}>
            <View style={styles.attachmentMenuContainer}>
              <View style={styles.attachmentMenuHeader}>
                <Text style={styles.attachmentMenuTitle}>Add Attachment</Text>
                <TouchableOpacity onPress={() => setShowAttachmentMenu(false)}>
                  <Text style={styles.attachmentMenuClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleTakePhoto}>
                <Text style={styles.attachmentMenuItemIcon}>📷</Text>
                <View style={styles.attachmentMenuItemText}>
                  <Text style={styles.attachmentMenuItemTitle}>Take Photo</Text>
                  <Text style={styles.attachmentMenuItemDesc}>Use your camera</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleChooseImage}>
                <Text style={styles.attachmentMenuItemIcon}>🖼️</Text>
                <View style={styles.attachmentMenuItemText}>
                  <Text style={styles.attachmentMenuItemTitle}>Choose from Library</Text>
                  <Text style={styles.attachmentMenuItemDesc}>Select from photos</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handleImportFile}>
                <Text style={styles.attachmentMenuItemIcon}>📄</Text>
                <View style={styles.attachmentMenuItemText}>
                  <Text style={styles.attachmentMenuItemTitle}>Import File</Text>
                  <Text style={styles.attachmentMenuItemDesc}>PDF, txt, doc</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachmentMenuItem} onPress={handlePasteFromClipboard}>
                <Text style={styles.attachmentMenuItemIcon}>📋</Text>
                <View style={styles.attachmentMenuItemText}>
                  <Text style={styles.attachmentMenuItemTitle}>Paste from Clipboard</Text>
                  <Text style={styles.attachmentMenuItemDesc}>Use copied text</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.attachmentMenuItem, styles.attachmentMenuItemDisabled]}
                onPress={() => {
                  Alert.alert(
                    'Image Generation Coming Soon',
                    'Image generation will be available soon.\n\nThis will require Stable Diffusion installed on KNIGHTSWATCH.\n\nYou can still send images from your device for analysis.'
                  );
                }}
              >
                <Text style={styles.attachmentMenuItemIcon}>🎨</Text>
                <View style={styles.attachmentMenuItemText}>
                  <Text style={styles.attachmentMenuItemTitle}>Generate Image</Text>
                  <Text style={styles.attachmentMenuItemDesc}>Coming soon</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Background overlay when in voice conversation */}
        {isVoiceConversation && (
          <View style={styles.voiceConversationOverlay} pointerEvents="none" />
        )}
      </KeyboardAvoidingView>

      {/* History Modal */}
      <Modal visible={showHistoryModal} animationType="slide" transparent={true}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Conversation History</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {sessions.length === 0 ? (
            <View style={styles.emptyHistoryContainer}>
              <Text style={styles.emptyHistoryText}>No conversation history yet</Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              renderItem={({ item: session }) => (
                <TouchableOpacity
                  style={styles.sessionItem}
                  onPress={() => handleResumeSession(session.id)}
                >
                  <View style={styles.sessionItemContent}>
                    <Text style={styles.sessionDate}>{formatSessionDate(session.startedAt)}</Text>
                    <Text style={styles.sessionPreview}>
                      {session.records.length === 0
                        ? 'Empty session'
                        : `${session.records.length} message${session.records.length !== 1 ? 's' : ''}`}
                    </Text>
                    {session.records.length > 0 && (
                      <Text style={styles.sessionFirstMessage} numberOfLines={1}>
                        &quot;{session.records[0].userMessage.substring(0, 50)}&quot;...
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.sessionsList}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    backgroundColor: Colors.surface,
  },
  minimalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.accent,
    textTransform: 'uppercase',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  headerBottom: {
    gap: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  date: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceModeButton: {
    padding: 6,
  },
  voiceModeIcon: {
    fontSize: 18,
  },
  muteButton: {
    padding: 6,
  },
  muteIcon: {
    fontSize: 18,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateHint: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  emptyStateHintText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  messageRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  userBubble: {
    backgroundColor: Colors.userBubble,
    borderLeftColor: Colors.accent,
  },
  assistantBubble: {
    backgroundColor: Colors.fridayBubble,
    borderLeftColor: Colors.accent,
  },
  messageText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  userText: {
    color: Colors.textPrimary,
  },
  assistantText: {
    color: Colors.textPrimary,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  typingBubble: {
    backgroundColor: Colors.fridayBubble,
    borderLeftColor: Colors.accent,
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 0,
  },
  speakingContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speakingIcon: {
    fontSize: 16,
    color: Colors.accent,
  },
  speakingText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.error + '15',
    borderWidth: 1,
    borderColor: Colors.error + '40',
    gap: 8,
  },
  errorIcon: {
    fontSize: 20,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopColor: Colors.accentSecondary,
    borderTopWidth: 1,
    backgroundColor: Colors.surface,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    maxHeight: 120,
  },
  plusButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButtonText: {
    fontSize: 20,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 100,
  },
  waveformButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendArrowButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendArrowButtonDisabled: {
    opacity: 0.5,
  },
  sendArrowText: {
    fontSize: 24,
    color: Colors.accent,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: Colors.background,
    fontWeight: '600',
    fontSize: 15,
  },
  recordButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  recordButtonActive: {
    backgroundColor: Colors.accent,
  },
  recordButtonIcon: {
    fontSize: 22,
  },
  voiceInputField: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 8,
    maxHeight: 100,
  },
  historyButton: {
    padding: 6,
  },
  historyIcon: {
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: Colors.accentSecondary,
    borderBottomWidth: 1,
    backgroundColor: Colors.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  closeButton: {
    fontSize: 24,
    color: '#888',
    paddingHorizontal: 8,
  },
  emptyHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#666',
  },
  sessionsList: {
    paddingVertical: 8,
  },
  sessionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: Colors.accentSecondary + '33',
    borderBottomWidth: 1,
  },
  sessionItemContent: {
    gap: 4,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  sessionPreview: {
    fontSize: 12,
    color: '#888',
  },
  sessionFirstMessage: {
    fontSize: 13,
    color: '#ccc',
    fontStyle: 'italic',
  },
  attachmentButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  attachmentIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.background,
  },
  attachmentPreviewContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    gap: 12,
  },
  attachmentPreview: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeAttachmentIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  filePreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filePreviewIcon: {
    fontSize: 32,
  },
  filePreviewName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  removeFileButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFileIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  attachmentMenuOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  attachmentMenuContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0,
    maxHeight: '80%',
  },
  attachmentMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
  },
  attachmentMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent,
  },
  attachmentMenuClose: {
    fontSize: 28,
    color: Colors.textMuted,
    fontWeight: 'bold',
  },
  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    gap: 16,
  },
  attachmentMenuItemIcon: {
    fontSize: 40,
  },
  attachmentMenuItemText: {
    flex: 1,
    gap: 4,
  },
  attachmentMenuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  attachmentMenuItemDesc: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  attachmentMenuItemDisabled: {
    opacity: 0.6,
  },
  messageBubbleImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  fileAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 6,
    marginBottom: 8,
  },
  fileIcon: {
    fontSize: 16,
  },
  fileName: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  voiceConversationIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  voiceStatusContainer: {
    paddingVertical: 8,
  },
  voiceStatusText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
  },
  inputContainerHidden: {
    display: 'none',
  },
  voiceConversationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000040',
    zIndex: 5,
  },
});
