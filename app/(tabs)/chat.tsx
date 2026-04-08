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
  AppState,
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

// Guard react-native-permissions like Voice - not available in Expo Go
let check: any = null;
let request: any = null;
let PERMISSIONS: any = null;
let RESULTS: any = null;

try {
  const perms = require('react-native-permissions');
  check = perms.check;
  request = perms.request;
  PERMISSIONS = perms.PERMISSIONS;
  RESULTS = perms.RESULTS;
} catch (e) {
  console.log('[ChatScreen] react-native-permissions not available in Expo Go');
}

import { speakWithFriday } from '@/services/voice';
import { recordAndTranscribe } from '@/services/voiceInput';
import {
  saveConversationRecord,
  getAllSessions,
  resumeSession,
  ConversationSession,
} from '@/services/fridayHistory';
import { fetchOllamaModels, getOllamaEndpoint } from '@/services/ollamaModels';
import { generateImage } from '@/services/comfyui';
import { checkConnectionStatus, getConnectionMessage, type ConnectionStatus } from '@/services/connectionStatus';
import { useFriday } from '@/hooks/useFriday';
import { detect as detectKnightswatch, ollamaUrl } from '@/services/knightswatch';
import { getToolResponse } from '@/services/tools';
import { shouldSearch, searchWeb, formatSearchContext } from '@/services/webSearch';
import { saveToMemory, getLatestDream, searchRemembered } from '@/services/memory';
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
  timestamp?: number; // milliseconds since epoch
}

const DEFAULT_MODEL = 'llama3.3:70b';

interface ChatScreenProps {
  sessionId?: string;
  initialMessages?: any[];
}

export default function ChatScreen({ sessionId, initialMessages }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>(initialMessages ? initialMessages.map((msg: any) => {
    // Convert created_at to timestamp if present
    let timestamp: number | undefined;
    if (msg.created_at) {
      timestamp = new Date(msg.created_at).getTime();
    }
    return {
      id: msg.id,
      role: msg.role,
      content: msg.content,
      imageBase64: msg.imageBase64,
      fileName: msg.fileName,
      fileContent: msg.fileContent,
      timestamp,
    };
  }) : []);
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
  const [shouldAutoSendOnSilence, setShouldAutoSendOnSilence] = useState(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceConversationRef = useRef(false);
  const [session, setSession] = useState<any>(null);
  const [authSession, setAuthSession] = useState<any>(null);
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(ollamaUrl());
  const ollamaEndpointRef = useRef<string>(ollamaUrl());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [autoSwitchIndicator, setAutoSwitchIndicator] = useState<string>('');
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [imageGenPrompt, setImageGenPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('red');
  const [showConnectionTooltip, setShowConnectionTooltip] = useState(false);
  const [connectionVia, setConnectionVia] = useState<'tailscale' | 'local'>('tailscale');

  // Friday AI Assistant integration with dynamic user settings
  const friday = useFriday({
    enabled: true,
    ollamaEndpoint,
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
    const endpoint = await getOllamaEndpoint();
    console.log('[ChatScreen] Loading models from endpoint:', endpoint);
    const models = await fetchOllamaModels();
    console.log('[ChatScreen] Raw models response:', JSON.stringify(models));
    setAvailableModels(models);
    if (models.length > 0) {
      console.log('[ChatScreen] Found', models.length, 'models');
      // Only set default if no preference saved yet
      const savedModel = await AsyncStorage.getItem('selectedModel');
      const modelExists = savedModel && models.some(m => m.model === savedModel || m.name === savedModel);
      if (!savedModel || !modelExists) {
        if (savedModel && !modelExists) console.log('[ChatScreen] Saved model not available:', savedModel, '- resetting to default');
        await AsyncStorage.setItem('selectedModel', DEFAULT_MODEL);
        setSelectedModel(DEFAULT_MODEL);
        console.log('[ChatScreen] Set default model to', DEFAULT_MODEL);
      }
    } else {
      console.log('[ChatScreen] No models found, using default');
    }
  }, []);

  // Check Ollama server status
  const checkServerStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const endpoint = ollamaEndpointRef.current;
      const response = await fetch(`${endpoint}/api/tags`, {
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
          setShouldAutoSendOnSilence(true);
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

  // Load messages when session ID changes (from prop or internal state)
  useEffect(() => {
    const loadPreviousMessages = async () => {
      // Use prop sessionId first, fall back to internal currentSessionId
      const idToLoad = sessionId || currentSessionId;
      console.log('[ChatScreen] Loading messages for session:', idToLoad, 'prop sessionId:', sessionId, 'currentSessionId:', currentSessionId);

      if (idToLoad && idToLoad !== '') {
        try {
          const previousMessages = await loadSessionMessages(idToLoad);
          console.log('[ChatScreen] Fetched messages from Supabase:', previousMessages.length);

          // Convert Supabase messages to Message format
          const formattedMessages: Message[] = previousMessages.map((msg: any) => {
            // Convert created_at timestamp if present
            let timestamp: number | undefined;
            if (msg.created_at) {
              timestamp = new Date(msg.created_at).getTime();
            }

            return {
              id: msg.id,
              role: msg.role,
              content: msg.content,
              imageBase64: msg.imageBase64,
              fileName: msg.fileName,
              fileContent: msg.fileContent,
              timestamp,
            };
          });

          setMessages(formattedMessages);
          // Also update internal state
          setCurrentSessionId(idToLoad);
          console.log('[ChatScreen] Loaded', formattedMessages.length, 'messages from session', idToLoad);
        } catch (err) {
          console.error('[ChatScreen] Failed to load session messages:', err);
        }
      }
    };
    loadPreviousMessages();
  }, [sessionId]);

  // Load settings, create session, check server, and fetch models on mount
  useEffect(() => {
    const initializeChat = async () => {
      await loadSettings();

      // Detect KNIGHTSWATCH (local network or Tailscale)
      try {
        await detectKnightswatch();
        const endpoint = ollamaUrl();
        setOllamaEndpoint(endpoint);
        ollamaEndpointRef.current = endpoint;
        console.log('[ChatScreen] Using KNIGHTSWATCH endpoint:', endpoint);
      } catch (error) {
        console.error('[ChatScreen] KNIGHTSWATCH detection failed, trying legacy:', error);
        try {
          const endpoint = await getOllamaEndpoint();
          setOllamaEndpoint(endpoint);
          ollamaEndpointRef.current = endpoint;
        } catch {}
      }

      // Check for dreams on app launch
      try {
        const dream = await getLatestDream();
        if (dream && messages.length === 0) {
          const dreamMessage: Message = {
            id: `dream_${Date.now()}`,
            role: 'assistant',
            content: `While you were away, I was thinking about... ${dream}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => prev.length === 0 ? [dreamMessage] : prev);
        }
      } catch {}

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
      checkServerStatus();
    };

    initializeChat();
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [loadSettings, loadModels, checkServerStatus, userProfile.name]);

  // Create initial session when authSession is available
  useEffect(() => {
    if (authSession?.user.id && !currentSessionId) {
      initializeSession();
    }
  }, [authSession?.user.id, currentSessionId]);

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

  // Update current time every minute for the header
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Check connection status on mount, every 30 seconds, and on app foreground
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await checkConnectionStatus();
        setConnectionStatus(status);
        // Determine which endpoint worked by checking them in order
        setConnectionVia('tailscale'); // Default to tailscale
      } catch (error) {
        console.error('[ChatScreen] Error checking connection status:', error);
      }
    };

    // Check on mount
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    // Listen for app foreground/background
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('[ChatScreen] App came to foreground, checking connection');
        checkConnection();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

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
      // Exit voice conversation mode - stop immediately
      try {
        console.log('[ChatScreen] Stopping voice recognition...');
        await Voice.stop();
      } catch (error) {
        console.error('[ChatScreen] Error stopping voice:', error);
      }

      // Reset all voice state
      setIsVoiceConversation(false);
      setIsVoiceListening(false);
      setVoiceConversationStatus(null);
      voiceConversationRef.current = false;
      setVoiceTranscript('');
      setInput('');

      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      console.log('[ChatScreen] Exited voice conversation mode');
    } else {
      // Enter voice conversation mode - request permissions first (if available)
      try {
        // Check if permissions module is available (not in Expo Go)
        if (!request) {
          console.log('[ChatScreen] Permissions not available in Expo Go, skipping permission checks');
          setIsVoiceConversation(true);
          voiceConversationRef.current = true;
          setVoiceTranscript('');
          setInput('');
          setVoiceConversationStatus('listening');

          try {
            await Voice.start('en-US');
            console.log('[ChatScreen] Entered voice conversation mode');
          } catch (voiceError) {
            console.error('[ChatScreen] Voice start error:', voiceError);
            const errorMsg = voiceError instanceof Error ? voiceError.message : String(voiceError);
            Alert.alert('Voice Error', errorMsg || 'Could not start voice recognition');

            setIsVoiceConversation(false);
            voiceConversationRef.current = false;
            setIsVoiceListening(false);
            setVoiceConversationStatus(null);
          }
          return;
        }

        // Check current permission status first (Release build with native modules)
        console.log('[ChatScreen] Checking microphone and speech recognition permissions...');

        const micStatus = await check(PERMISSIONS.IOS.MICROPHONE);
        const speechStatus = await check(PERMISSIONS.IOS.SPEECH_RECOGNITION);

        console.log('[ChatScreen] Microphone status:', micStatus, 'Speech status:', speechStatus);

        // If both already granted, skip requesting and go straight to voice
        if (micStatus === RESULTS.GRANTED && speechStatus === RESULTS.GRANTED) {
          console.log('[ChatScreen] Permissions already granted, starting voice recognition...');
          setIsVoiceConversation(true);
          voiceConversationRef.current = true;
          setVoiceTranscript('');
          setInput('');
          setVoiceConversationStatus('listening');

          try {
            await Voice.start('en-US');
            console.log('[ChatScreen] Entered voice conversation mode');
          } catch (voiceError) {
            console.error('[ChatScreen] Voice start error:', voiceError);
            const errorMsg = voiceError instanceof Error ? voiceError.message : String(voiceError);
            Alert.alert('Voice Error', errorMsg || 'Could not start voice recognition');

            setIsVoiceConversation(false);
            voiceConversationRef.current = false;
            setIsVoiceListening(false);
            setVoiceConversationStatus(null);
          }
          return;
        }

        // Request microphone permission if not granted
        if (micStatus !== RESULTS.GRANTED) {
          console.log('[ChatScreen] Requesting microphone permission...');
          const micResult = await request(PERMISSIONS.IOS.MICROPHONE);
          console.log('[ChatScreen] Microphone permission result:', micResult);

          if (micResult !== RESULTS.GRANTED) {
            console.warn('[ChatScreen] Microphone permission denied');
            Alert.alert(
              'Permission Required',
              'Please allow microphone access in Settings to use voice features.'
            );
            return;
          }
        }

        // Request speech recognition permission if not granted
        if (speechStatus !== RESULTS.GRANTED) {
          console.log('[ChatScreen] Requesting speech recognition permission...');
          const speechResult = await request(PERMISSIONS.IOS.SPEECH_RECOGNITION);
          console.log('[ChatScreen] Speech recognition permission result:', speechResult);

          if (speechResult !== RESULTS.GRANTED) {
            console.warn('[ChatScreen] Speech recognition permission denied');
            Alert.alert(
              'Permission Required',
              'Please allow speech recognition access in Settings to use voice features.'
            );
            return;
          }
        }

        // Both permissions granted - start voice
        console.log('[ChatScreen] Permissions granted, starting voice recognition...');
        setIsVoiceConversation(true);
        voiceConversationRef.current = true;
        setVoiceTranscript('');
        setInput('');
        setVoiceConversationStatus('listening');

        try {
          await Voice.start('en-US');
          console.log('[ChatScreen] Entered voice conversation mode');
        } catch (voiceError) {
          console.error('[ChatScreen] Voice start error:', voiceError);
          const errorMsg = voiceError instanceof Error ? voiceError.message : String(voiceError);
          Alert.alert('Voice Error', errorMsg || 'Could not start voice recognition');

          setIsVoiceConversation(false);
          voiceConversationRef.current = false;
          setIsVoiceListening(false);
          setVoiceConversationStatus(null);
        }
      } catch (error) {
        console.error('[ChatScreen] Error in voice setup:', error);
        setIsVoiceConversation(false);
        voiceConversationRef.current = false;
        setIsVoiceListening(false);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Voice Error', errorMsg);
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

  const handleGenerateImage = async () => {
    if (!imageGenPrompt.trim()) {
      Alert.alert('Empty Prompt', 'Please describe what you want to generate');
      return;
    }

    setIsGeneratingImage(true);

    try {
      console.log('[ChatScreen] Starting image generation with prompt:', imageGenPrompt);
      const base64Image = await generateImage(imageGenPrompt);

      // Create a message with the generated image
      const generatedImageMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Generated image: "${imageGenPrompt}"`,
        imageBase64: base64Image,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, generatedImageMessage]);

      // Save to Supabase if in a session
      if (currentSessionId && authSession?.user.id) {
        try {
          await saveMessage(currentSessionId, authSession.user.id, {
            id: generatedImageMessage.id,
            role: 'assistant',
            content: generatedImageMessage.content,
            imageBase64: base64Image,
            created_at: new Date().toISOString(),
          });
        } catch (err) {
          console.error('[ChatScreen] Failed to save generated image to Supabase:', err);
        }
      }

      // Close modal and reset
      setShowImageGenModal(false);
      setImageGenPrompt('');
      console.log('[ChatScreen] Image generation complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[ChatScreen] Image generation failed:', errorMsg);

      if (errorMsg.includes('ComfyUI not found')) {
        Alert.alert(
          'ComfyUI Not Found',
          'Image generation requires home network connection.\n\nEnsure ComfyUI is running on KNIGHTSWATCH:\nComfyUI must be on the same network and running.'
        );
      } else if (errorMsg.includes('timeout')) {
        Alert.alert(
          'Generation Timeout',
          'The image generation took too long. Please try again with a simpler prompt.'
        );
      } else {
        Alert.alert('Generation Failed', errorMsg);
      }
    } finally {
      setIsGeneratingImage(false);
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

  const exitVoiceMode = () => {
    setIsVoiceConversation(false);
    setVoiceConversationStatus(null);
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

  // Smart model selection based on task
  const selectBestModel = (
    message: string,
    hasImage: boolean,
    availableModelsList: any[]
  ): { model: string; autoSwitched: boolean; indicator: string } => {
    // Vision model for images
    if (hasImage) {
      const visionModels = availableModelsList.filter(m => {
        const lower = m.model.toLowerCase();
        return lower.includes('vision') || lower.includes('llava') || lower.includes('moondream') || lower.includes('qwen-vl');
      });
      if (visionModels.length > 0 && !selectedModel.toLowerCase().includes('vision') && !selectedModel.toLowerCase().includes('llava')) {
        return { model: visionModels[0].model, autoSwitched: true, indicator: 'Switching to vision model for image analysis...' };
      }
    }

    // Coding model for code-related questions
    if (/code|debug|function|error|bug|python|javascript|typescript|react|node|function|syntax|compile/i.test(message)) {
      const codingModels = availableModelsList.filter(m => {
        const lower = m.model.toLowerCase();
        return lower.includes('coder') || lower.includes('code');
      });
      if (codingModels.length > 0 && selectedModel !== codingModels[0].model) {
        return { model: codingModels[0].model, autoSwitched: true, indicator: 'Switching to coding model...' };
      }
    }

    // Deep reasoning for complex topics
    if (/physics|math|quantum|theorem|calculate|prove|astronomy|black hole|relativity|equation|algebra|calculus|geometry/i.test(message)) {
      return { model: 'llama3.3:70b', autoSwitched: selectedModel !== 'llama3.3:70b', indicator: 'Switching to advanced reasoning model...' };
    }

    // Default model
    return { model: DEFAULT_MODEL, autoSwitched: false, indicator: '' };
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await handleSendMessage(input);
  };

  const handleSendMessage = async (message: string) => {
    // Smart model selection based on message content and attachments
    const { model: selectedBestModel, autoSwitched, indicator } = selectBestModel(
      message,
      !!attachedImage,
      availableModels
    );
    let finalModel = selectedBestModel;

    // Show auto-switch indicator
    if (autoSwitched && indicator) {
      setAutoSwitchIndicator(indicator);
      setTimeout(() => setAutoSwitchIndicator(''), 2000);
      console.log('[ChatScreen]', indicator);
    }

    // Check if image is attached but no vision model available
    if (attachedImage && !isVisionModel(finalModel)) {
      const visionModels = findVisionModels();
      if (visionModels.length === 0) {
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
      timestamp: Date.now(),
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

      // ─── Tool responses: instant answers without Ollama ───
      const toolResponse = getToolResponse(message);
      if (toolResponse && !attachedImage && !attachedFile) {
        const duration = Date.now() - startTime;
        console.log('[ChatScreen] Tool response (no LLM):', toolResponse);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: toolResponse,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setLoading(false);
        if (isVoiceConversation) setVoiceConversationStatus(null);
        // Auto-speak tool response
        if (autoSpeak) {
          try { await speakWithFriday(toolResponse); } catch {}
        }
        // Save to memory API
        try { await saveToMemory(message, toolResponse); } catch {}
        return;
      }

      // ─── Remember feature ───
      const lowerMsg = message.toLowerCase();
      const isRememberSave = /remember (to|that)|don't forget/i.test(lowerMsg);
      const isRememberRecall = /what did i ask you to remember|what do you remember/i.test(lowerMsg);

      if (isRememberRecall) {
        const remembered = await searchRemembered();
        if (remembered) {
          const recallMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: remembered,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, recallMsg]);
          setLoading(false);
          if (isVoiceConversation) setVoiceConversationStatus(null);
          if (autoSpeak) {
            try { await speakWithFriday(remembered); } catch {}
          }
          return;
        }
      }

      if (isRememberSave) {
        const gotIt = 'Got it.';
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: gotIt,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setLoading(false);
        if (isVoiceConversation) setVoiceConversationStatus(null);
        if (autoSpeak) {
          try { await speakWithFriday(gotIt); } catch {}
        }
        try { await saveToMemory(message, gotIt); } catch {}
        return;
      }

      // ─── Web search if needed ───
      let messageContent = message;
      if (attachedFile) {
        messageContent = `${message}\n\n[File: ${attachedFile.name}]\n${attachedFile.content}`;
      }

      if (shouldSearch(message) && !attachedImage) {
        console.log('[ChatScreen] Web search triggered for:', message);
        const searchResults = await searchWeb(message);
        if (searchResults) {
          messageContent = formatSearchContext(searchResults, message);
          console.log('[ChatScreen] Injected search results into context');
        }
      }

      // Send message directly to Friday (which talks to Ollama)
      // Pass conversation history for context
      // If image is attached, use vision model; otherwise use selected model
      const response = attachedImage
        ? await friday.sendMessageWithImage(messageContent, attachedImage.base64, messages, finalModel)
        : await friday.sendMessage(messageContent, messages, finalModel);
      const duration = Date.now() - startTime;

      console.log('[ChatScreen] Got response from Friday:', response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save to KNIGHTSWATCH memory API (non-blocking)
      saveToMemory(message, response).catch(() => {});

      // Auto-detect if Friday is suggesting image generation
      const responseLower = response.toLowerCase();
      if (
        responseLower.includes('generate image') ||
        responseLower.includes('create an image') ||
        responseLower.includes('generate an image') ||
        responseLower.includes('tap the + button') ||
        responseLower.includes('select "generate image"')
      ) {
        console.log('[ChatScreen] Detected image generation suggestion, opening modal');
        setShowImageGenModal(true);
      }

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
      // Check connection status after message attempt
      try {
        const status = await checkConnectionStatus();
        setConnectionStatus(status);
      } catch (err) {
        console.error('[ChatScreen] Error checking connection after message:', err);
      }
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

  // Format current date
  const formatCurrentDate = (): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = days[currentTime.getDay()];
    const month = months[currentTime.getMonth()];
    const date = currentTime.getDate();
    return `${day}, ${month} ${date}`;
  };

  // Format message timestamp as time only
  const formatMessageTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Check if should show timestamp above this message
  // Show if: first message, or > 1 minute gap from previous message
  const shouldShowTimestamp = (messageIndex: number): boolean => {
    if (messageIndex < 0 || messageIndex >= messages.length) return false;
    const message = messages[messageIndex];
    if (!message.timestamp) return false;

    // Always show on first message
    if (messageIndex === 0) return true;

    // Check time gap from previous message
    const previousMessage = messages[messageIndex - 1];
    if (!previousMessage.timestamp) return true;

    // Show if > 1 minute (60000 ms) gap
    const timeDiff = message.timestamp - previousMessage.timestamp;
    return timeDiff > 60000;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Date text with connection indicator at very top */}
        <TouchableOpacity
          style={{ paddingTop: insets.top - 50, alignItems: 'center' }}
          onPress={() => setShowConnectionTooltip(true)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  connectionStatus === 'green'
                    ? '#00FF88'
                    : connectionStatus === 'yellow'
                    ? '#FFD700'
                    : '#FF4466',
              }}
            />
            <Text style={{ fontSize: 12, color: '#8888AA', fontWeight: '500' }}>
              {formatCurrentDate()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* FRIDAY label above cyan line */}
        <View style={{ paddingLeft: 14, paddingBottom: 4 }}>
          <Text style={{ fontSize: 10, color: '#00D4FF', fontWeight: '600', letterSpacing: 3, opacity: 0.7 }}>
            F.R.I.D.A.Y.
          </Text>
        </View>

        {/* Cyan header line immediately below date */}
        <View style={{
          height: 2,
          backgroundColor: '#00D4FF',
          width: '100%'
        }} />

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
          {messages.map((message, index) => (
            <View key={message.id}>
              {/* Timestamp above message if gap > 1 minute */}
              {shouldShowTimestamp(index) && (
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                  <Text style={{
                    fontSize: 12,
                    color: '#8888AA',
                    fontWeight: '500',
                  }}>
                    {formatMessageTime(message.timestamp)}
                  </Text>
                </View>
              )}
              {/* Message bubble */}
              <View
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
                      resizeMode="contain"
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
          <TouchableOpacity
            style={styles.voiceConversationIndicator}
            onPress={exitVoiceMode}
            activeOpacity={0.7}
          >
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
                  <Text style={styles.voiceStatusText}>🎤 Listening... tap to stop</Text>
                </Animated.View>
              )}
              {voiceConversationStatus === 'thinking' && (
                <Text style={styles.voiceStatusText}>💭 Thinking...</Text>
              )}
              {voiceConversationStatus === 'speaking' && (
                <Text style={styles.voiceStatusText}>🔊 Speaking...</Text>
              )}
            </View>
          </TouchableOpacity>
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
              onChangeText={(text) => {
                setInput(text);
                // Exit voice mode if user starts typing
                if (isVoiceConversation && text.trim().length > 0) {
                  exitVoiceMode();
                }
              }}
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
                  setShowAttachmentMenu(false);
                  setShowImageGenModal(true);
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

        {/* Image Generation Modal */}
        <Modal
          visible={showImageGenModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => !isGeneratingImage && setShowImageGenModal(false)}
        >
          <View style={styles.imageGenModalOverlay}>
            <View style={styles.imageGenModalSheet}>
              {/* Header */}
              <View style={styles.imageGenHeader}>
                <TouchableOpacity
                  onPress={() => !isGeneratingImage && setShowImageGenModal(false)}
                  disabled={isGeneratingImage}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Text style={[styles.imageGenCloseIcon, isGeneratingImage && { opacity: 0.5 }]}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.imageGenTitle}>Generate Image</Text>
                <View style={{ width: 40 }} />
              </View>

              <ScrollView style={styles.imageGenContent} showsVerticalScrollIndicator={false}>
                {/* Description */}
                <Text style={styles.imageGenLabel}>Describe what you want to create:</Text>

                {/* Text Input */}
                <TextInput
                  style={styles.imageGenInput}
                  placeholder="A beautiful sunset over mountains..."
                  placeholderTextColor="#5A5A7A"
                  value={imageGenPrompt}
                  onChangeText={setImageGenPrompt}
                  multiline
                  editable={!isGeneratingImage}
                  maxLength={500}
                />

                {/* Generate Button */}
                <TouchableOpacity
                  style={[
                    styles.imageGenButton,
                    isGeneratingImage || !imageGenPrompt.trim() ? styles.imageGenButtonDisabled : {},
                  ]}
                  disabled={isGeneratingImage || !imageGenPrompt.trim()}
                  onPress={handleGenerateImage}
                  activeOpacity={0.7}
                >
                  <Text style={styles.imageGenButtonText}>
                    {isGeneratingImage ? '🎨 Generating...' : 'Generate Image'}
                  </Text>
                </TouchableOpacity>

                {/* Info */}
                <View style={styles.imageGenInfo}>
                  <Text style={styles.imageGenInfoIcon}>ℹ️</Text>
                  <Text style={styles.imageGenInfoText}>
                    Image generation requires ComfyUI with Flux Dev model on KNIGHTSWATCH.
                  </Text>
                </View>

                <View style={styles.imageGenCommand}>
                  <Text style={styles.imageGenCommandLabel}>ComfyUI must be running with Flux Dev:</Text>
                  <Text style={styles.imageGenCommandText}>ComfyUI running on home network</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Background overlay when in voice conversation */}
        {isVoiceConversation && (
          <View style={styles.voiceConversationOverlay} pointerEvents="none" />
        )}
      </KeyboardAvoidingView>

      {/* Connection Status Tooltip Modal */}
      <Modal
        visible={showConnectionTooltip}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConnectionTooltip(false)}
      >
        <TouchableOpacity
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={() => setShowConnectionTooltip(false)}
        >
          <View style={styles.tooltipContainer}>
            <View
              style={[
                styles.tooltipDot,
                {
                  backgroundColor:
                    connectionStatus === 'green'
                      ? '#00FF88'
                      : connectionStatus === 'yellow'
                      ? '#FFD700'
                      : '#FF4466',
                },
              ]}
            />
            <Text style={styles.tooltipText}>
              {getConnectionMessage(connectionStatus, connectionVia)}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

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
    paddingBottom: 0,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
    paddingVertical: 6,
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
    flexGrow: 1,
    justifyContent: 'center',
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
    width: '100%',
    height: 300,
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
  imageGenModalOverlay: {
    flex: 1,
    backgroundColor: '#00000040',
    justifyContent: 'flex-end',
  },
  imageGenModalSheet: {
    backgroundColor: '#12121A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  imageGenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
  },
  imageGenCloseIcon: {
    fontSize: 20,
    color: '#5A5A7A',
    fontWeight: '600',
  },
  imageGenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  imageGenContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  imageGenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  imageGenInput: {
    backgroundColor: '#1A1A22',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#8888AA',
    fontSize: 14,
    minHeight: 100,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E1E2E',
  },
  imageGenButton: {
    backgroundColor: '#00D4FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  imageGenButtonDisabled: {
    backgroundColor: '#5A5A7A',
    opacity: 0.5,
  },
  imageGenButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageGenInfo: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2240',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
  },
  imageGenInfoIcon: {
    fontSize: 16,
  },
  imageGenInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#8888AA',
    lineHeight: 16,
  },
  imageGenCommand: {
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#00D4FF',
  },
  imageGenCommandLabel: {
    fontSize: 11,
    color: '#5A5A7A',
    marginBottom: 4,
  },
  imageGenCommandText: {
    fontSize: 12,
    color: '#00D4FF',
    fontFamily: 'Courier New',
    fontWeight: '500',
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContainer: {
    backgroundColor: '#1A1A22',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tooltipDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    flexShrink: 0,
  },
  tooltipText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
});
