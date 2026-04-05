import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Modal,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchOllamaModels, OllamaModel, getModelLabel, formatModelSize, getOllamaEndpoint } from '@/services/ollamaModels';
import { Colors } from '@/constants/theme';
import { UserProfile, DEFAULT_USER_PROFILE, TIMEZONES } from '@/constants/onboarding';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [voiceInput, setVoiceInput] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<'elevenlabs' | 'moira'>('elevenlabs');
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
  const [lastChecked, setLastChecked] = useState('');
  const [lastModelsRefresh, setLastModelsRefresh] = useState('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://100.112.253.127:11434');
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingTimezone, setEditingTimezone] = useState('UTC');
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [timezoneSearchQuery, setTimezoneSearchQuery] = useState('');

  const loadModels = useCallback(async () => {
    try {
      console.log('[Settings] Fetching available models from Ollama...');
      const models = await fetchOllamaModels();
      if (models.length > 0) {
        setAvailableModels(models);
        setLastModelsRefresh(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('[Settings] Error loading models:', error);
    }
  }, []);

  const checkServerStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const endpoint = await getOllamaEndpoint();
      setOllamaEndpoint(endpoint);

      const response = await fetch(`${endpoint}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        setServerStatus('online');
        // Optionally reload models when server comes online
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
    setLastChecked(new Date().toLocaleTimeString());
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [model, speak, voice, engine, profileJson, lastRefresh] = await Promise.all([
        AsyncStorage.getItem('selectedModel'),
        AsyncStorage.getItem('autoSpeak'),
        AsyncStorage.getItem('voiceInput'),
        AsyncStorage.getItem('voiceEngine'),
        AsyncStorage.getItem('userProfile'),
        AsyncStorage.getItem('lastModelsRefresh'),
      ]);

      if (model) setSelectedModel(model);
      setAutoSpeak(speak === 'true');
      setVoiceInput(voice === 'true');
      if (engine === 'moira') {
        setVoiceEngine('moira');
      } else {
        setVoiceEngine('elevenlabs');
      }

      if (profileJson) {
        try {
          const profile = JSON.parse(profileJson);
          setUserProfile(profile);
          setEditingName(profile.name);
          setEditingTimezone(profile.timezone);
        } catch (e) {
          console.error('Error parsing user profile:', e);
        }
      }

      if (lastRefresh) {
        setLastModelsRefresh(lastRefresh);
      }

      await loadModels();
      checkServerStatus();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, [loadModels, checkServerStatus]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleModelSelect = async (model: string) => {
    setSelectedModel(model);
    await AsyncStorage.setItem('selectedModel', model);
  };

  const handleAutoSpeakToggle = async (value: boolean) => {
    setAutoSpeak(value);
    await AsyncStorage.setItem('autoSpeak', value.toString());
  };

  const handleVoiceInputToggle = async (value: boolean) => {
    setVoiceInput(value);
    await AsyncStorage.setItem('voiceInput', value.toString());
  };

  const handleVoiceEngineSelect = async (engine: 'elevenlabs' | 'moira') => {
    setVoiceEngine(engine);
    await AsyncStorage.setItem('voiceEngine', engine);
  };

  const handleOpenProfileModal = () => {
    setEditingName(userProfile.name);
    setEditingTimezone(userProfile.timezone);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editingName.trim()) {
      Alert.alert('Invalid Input', 'Please enter your name');
      return;
    }

    const updatedProfile: UserProfile = {
      name: editingName.trim(),
      timezone: editingTimezone,
    };

    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      setUserProfile(updatedProfile);
      setShowProfileModal(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Small delay to ensure Supabase session is fully cleared
              await new Promise(resolve => setTimeout(resolve, 100));
              // Navigation will be handled by the auth state listener in _layout.tsx
              console.log('[Settings] User signed out');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.screenTitle}>SETTINGS</Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileGreeting}>Hi, {userProfile.name || 'Friend'}! 👋</Text>
              <Text style={styles.profileDetail}>Timezone: {userProfile.timezone}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleOpenProfileModal}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Model Section */}
        <View style={styles.section}>
          <View style={styles.modelHeaderRow}>
            <Text style={styles.sectionTitle}>AI Model</Text>
            <TouchableOpacity
              style={styles.refreshModelsButton}
              onPress={checkServerStatus}
            >
              <Text style={styles.refreshModelsText}>↻</Text>
            </TouchableOpacity>
          </View>

          {lastModelsRefresh && (
            <Text style={styles.lastRefreshText}>
              Last checked: {lastModelsRefresh}
            </Text>
          )}

          {availableModels.length === 0 ? (
            <Text style={styles.noModelsText}>
              {serverStatus === 'offline'
                ? 'Ollama offline - cannot load models'
                : 'Loading models...'}
            </Text>
          ) : (
            availableModels.map((model) => (
              <TouchableOpacity
                key={model.model}
                style={[
                  styles.modelButton,
                  selectedModel === model.model && styles.modelButtonActive,
                ]}
                onPress={() => handleModelSelect(model.model)}
              >
                <View style={styles.modelContent}>
                  <Text
                    style={[
                      styles.modelText,
                      selectedModel === model.model && styles.modelTextActive,
                    ]}
                  >
                    {model.name}
                  </Text>
                  <View style={styles.modelDetailsRow}>
                    <Text style={styles.modelLabel}>
                      {getModelLabel(model.model)}
                    </Text>
                    <Text style={styles.modelSize}>
                      {formatModelSize(model.size)}
                    </Text>
                  </View>
                </View>
                {selectedModel === model.model && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Voice Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleLabel}>Auto-speak responses</Text>
              <Text style={styles.toggleHint}>F.R.I.D.A.Y. speaks answers</Text>
            </View>
            <Switch
              value={autoSpeak}
              onValueChange={handleAutoSpeakToggle}
              trackColor={{ false: '#3A4A5A', true: Colors.accent + '40' }}
              thumbColor={autoSpeak ? Colors.accent : '#8A8A8A'}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleLabel}>Voice input mode</Text>
              <Text style={styles.toggleHint}>Tap mic to send messages</Text>
            </View>
            <Switch
              value={voiceInput}
              onValueChange={handleVoiceInputToggle}
              trackColor={{ false: '#3A4A5A', true: Colors.accent + '40' }}
              thumbColor={voiceInput ? Colors.accent : '#8A8A8A'}
            />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Voice Engine</Text>
          <TouchableOpacity
            style={[
              styles.voiceEngineButton,
              voiceEngine === 'elevenlabs' && styles.voiceEngineButtonActive,
            ]}
            onPress={() => handleVoiceEngineSelect('elevenlabs')}
          >
            <View style={styles.voiceEngineContent}>
              <Text
                style={[
                  styles.voiceEngineText,
                  voiceEngine === 'elevenlabs' && styles.voiceEngineTextActive,
                ]}
              >
                ElevenLabs (Friday Voice)
              </Text>
              <Text style={styles.voiceEngineHint}>Natural AI voice</Text>
            </View>
            {voiceEngine === 'elevenlabs' && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.voiceEngineButton,
              voiceEngine === 'moira' && styles.voiceEngineButtonActive,
            ]}
            onPress={() => handleVoiceEngineSelect('moira')}
          >
            <View style={styles.voiceEngineContent}>
              <Text
                style={[
                  styles.voiceEngineText,
                  voiceEngine === 'moira' && styles.voiceEngineTextActive,
                ]}
              >
                Apple Moira (Offline)
              </Text>
              <Text style={styles.voiceEngineHint}>Works without internet</Text>
            </View>
            {voiceEngine === 'moira' && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Connection Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ollama Connection</Text>

          <View style={styles.connectionBox}>
            <View style={styles.statusRow}>
              <View style={styles.statusIndicator}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        serverStatus === 'online' ? Colors.accent : '#FF6B6B',
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            <Text style={styles.urlText}>
              {ollamaEndpoint}
            </Text>

            {availableModels.length > 0 && (
              <Text style={styles.modelsCountText}>
                {availableModels.length} model{availableModels.length !== 1 ? 's' : ''} loaded
              </Text>
            )}

            {lastChecked && (
              <Text style={styles.timestampText}>
                Last checked: {lastChecked}
              </Text>
            )}

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={checkServerStatus}
            >
              <Text style={styles.refreshText}>Check Connection</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={!editingName.trim()}
            >
              <Text style={[
                styles.modalSave,
                !editingName.trim() && styles.modalSaveDisabled,
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={editingName}
                onChangeText={setEditingName}
                maxLength={50}
              />
            </View>

            <View style={styles.modalFormGroup}>
              <Text style={styles.modalLabel}>Timezone</Text>
              <TouchableOpacity
                style={styles.timezoneButton}
                onPress={() => setShowTimezoneModal(true)}
              >
                <Text style={styles.timezoneButtonText}>{editingTimezone}</Text>
                <Text style={styles.timezoneIcon}>▼</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Timezone Selection Modal */}
          <Modal
            visible={showTimezoneModal}
            animationType="slide"
            transparent={false}
            onRequestClose={() => setShowTimezoneModal(false)}
          >
            <SafeAreaView style={styles.timezoneModalContainer}>
              <View style={styles.timezoneModalHeader}>
                <Text style={styles.timezoneModalTitle}>Select Timezone</Text>
                <TouchableOpacity onPress={() => setShowTimezoneModal(false)}>
                  <Text style={styles.timezoneModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search timezone..."
                  placeholderTextColor="#666"
                  value={timezoneSearchQuery}
                  onChangeText={setTimezoneSearchQuery}
                />
              </View>

              <FlatList
                data={TIMEZONES.filter((tz) =>
                  tz.toLowerCase().includes(timezoneSearchQuery.toLowerCase())
                )}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.timezoneOption,
                      editingTimezone === item && styles.timezoneOptionActive,
                    ]}
                    onPress={() => {
                      setEditingTimezone(item);
                      setShowTimezoneModal(false);
                      setTimezoneSearchQuery('');
                    }}
                  >
                    <Text
                      style={[
                        styles.timezoneOptionText,
                        editingTimezone === item && styles.timezoneOptionTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                    {editingTimezone === item && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            </SafeAreaView>
          </Modal>
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
  content: {
    flex: 1,
    padding: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: Colors.accent,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.accentSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  modelButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3A4A5A',
  },
  modelButtonActive: {
    backgroundColor: '#1A3A2A',
    borderLeftColor: Colors.accent,
  },
  modelContent: {
    flex: 1,
  },
  modelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  modelTextActive: {
    color: Colors.accent,
  },
  modelLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  modelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshModelsButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: Colors.accentSecondary + '30',
  },
  refreshModelsText: {
    fontSize: 16,
    color: Colors.accentSecondary,
    fontWeight: '600',
  },
  lastRefreshText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 12,
  },
  noModelsText: {
    fontSize: 13,
    color: '#888',
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },
  modelDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  modelSize: {
    fontSize: 10,
    color: '#555',
    fontFamily: 'monospace',
  },
  modelsCountText: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 18,
    color: Colors.accent,
    marginLeft: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentSecondary + '66',
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  toggleHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  connectionBox: {
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentSecondary + '66',
  },
  statusRow: {
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#fff',
  },
  urlText: {
    fontSize: 12,
    color: Colors.accentSecondary,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  timestampText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 12,
  },
  refreshButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.accent,
    borderRadius: 6,
    alignItems: 'center',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  voiceEngineButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3A4A5A',
  },
  voiceEngineButtonActive: {
    backgroundColor: '#1A3A2A',
    borderLeftColor: Colors.accent,
  },
  voiceEngineContent: {
    flex: 1,
  },
  voiceEngineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  voiceEngineTextActive: {
    color: Colors.accent,
  },
  voiceEngineHint: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  spacer: {
    height: 40,
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: 8,
  },
  profileInfo: {
    flex: 1,
  },
  profileGreeting: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 12,
    color: '#888',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.accentSecondary + '30',
    borderRadius: 6,
    marginLeft: 12,
  },
  editButtonText: {
    color: Colors.accentSecondary,
    fontWeight: '600',
    fontSize: 14,
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 1,
  },
  modalClose: {
    fontSize: 28,
    color: Colors.accentSecondary,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  modalSave: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFormGroup: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: Colors.accentSecondary + '66',
    fontSize: 16,
  },
  timezoneButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.accentSecondary + '66',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timezoneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  timezoneIcon: {
    color: Colors.accentSecondary,
    fontSize: 12,
  },
  timezoneModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  timezoneModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: Colors.accentSecondary,
    borderBottomWidth: 1,
  },
  timezoneModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 1,
  },
  timezoneModalClose: {
    fontSize: 28,
    color: Colors.accentSecondary,
    fontWeight: 'bold',
    paddingHorizontal: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: Colors.accentSecondary + '66',
  },
  timezoneOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  timezoneOptionActive: {
    backgroundColor: '#1A3A2A',
  },
  timezoneOptionText: {
    fontSize: 15,
    color: '#888',
    flex: 1,
  },
  timezoneOptionTextActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FF6B6B' + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    letterSpacing: 0.5,
  },
});
