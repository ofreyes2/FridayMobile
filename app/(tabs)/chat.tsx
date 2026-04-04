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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speakWithFriday } from '@/services/voice';
import { recordAndTranscribe } from '@/services/voiceInput';
import {
  createSession,
  saveConversationRecord,
  getAllSessions,
  resumeSession,
  ConversationSession,
} from '@/services/fridayHistory';
import { fetchOllamaModels } from '@/services/ollamaModels';
import { useFriday } from '@/hooks/useFriday';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';
import { UserProfile, DEFAULT_USER_PROFILE } from '@/constants/onboarding';
import { getGreeting, formatDate } from '@/lib/greetings';
import { TypingIndicator } from '@/components/TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODEL = 'llama3.3:70b';

export default function ChatScreen() {
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
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;
  const dot4Anim = useRef(new Animated.Value(0)).current;
  const dot5Anim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const modalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load models from Ollama
  const loadModels = useCallback(async () => {
    console.log('[ChatScreen] Fetching available models from Ollama...');
    const models = await fetchOllamaModels();
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
      const newSession = await createSession();
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
    }
  };

  const handleMuteToggle = async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await AsyncStorage.setItem('isMuted', newMuted.toString());
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
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    const startTime = Date.now();

    try {
      console.log('[ChatScreen] Sending message to Friday:', message);

      // Send message directly to Friday (which talks to Ollama)
      const response = await friday.sendMessage(message);
      const duration = Date.now() - startTime;

      console.log('[ChatScreen] Got response from Friday:', response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Save to history
      if (currentSessionId) {
        await saveConversationRecord(currentSessionId, {
          timestamp: Date.now(),
          userMessage: message,
          fridayResponse: response,
          duration,
        });
      }

      if (autoSpeak) {
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

      // Save error to history
      if (currentSessionId) {
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
      const newSession = await createSession();
      setCurrentSessionId(newSession.id);
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
        {/* Professional Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.titleSection}>
              <Text style={styles.appName}>F.R.I.D.A.Y.</Text>
              <View style={styles.statusIndicator}>
                <Animated.View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        serverStatus === 'online' ? Colors.accentSuccess : Colors.error,
                    },
                  ]}
                />
                <Text style={styles.statusLabel}>
                  {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <View style={styles.headerControls}>
              <TouchableOpacity style={styles.historyButton} onPress={handleOpenHistory}>
                <Text style={styles.historyIcon}>📜</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.voiceModeButton}
                onPress={handleVoiceModeToggle}
              >
                <Text style={styles.voiceModeIcon}>{voiceMode ? '🎤' : '📝'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.muteButton}
                onPress={handleMuteToggle}
              >
                <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🔊'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting and Date */}
          <View style={styles.headerBottom}>
            <Text style={styles.greeting}>
              {getGreeting(userProfile.name || 'Friend')}
            </Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
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
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' ? styles.userText : styles.assistantText,
                  ]}
                >
                  {message.content}
                </Text>
              </View>
              {message.role === 'assistant' && (
                <TouchableOpacity
                  style={styles.speakerButton}
                  onPress={() => speakText(message.content)}
                >
                  <Text style={styles.speakerIcon}>🔊</Text>
                </TouchableOpacity>
              )}
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

        <View style={styles.inputContainer}>
          {!voiceMode ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Type your message..."
                placeholderTextColor="#666"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={1000}
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={loading || !input.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                onPress={handleVoiceRecord}
                disabled={isRecording || loading}
              >
                <Text style={styles.recordButtonIcon}>🎙️</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.voiceInputField}
                placeholder="Tap mic to record..."
                placeholderTextColor="#666"
                value={voiceInput}
                onChangeText={setVoiceInput}
                multiline
                maxLength={1000}
                editable={!isRecording}
              />
              <TouchableOpacity
                style={[styles.sendButton, !voiceInput.trim() && styles.sendButtonDisabled]}
                onPress={handleVoiceInputSubmit}
                disabled={loading || !voiceInput.trim() || isRecording}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

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
  speakerButton: {
    padding: 6,
    marginBottom: 4,
  },
  speakerIcon: {
    fontSize: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: Colors.accentSecondary,
    borderTopWidth: 1,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 100,
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
});
