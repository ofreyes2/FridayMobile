import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIMEZONES, UserProfile } from '@/constants/onboarding';
import { ACCENT_GREEN, ACCENT_BLUE, DARK_BG } from '@/constants/theme';

interface OnboardingProps {
  visible: boolean;
  onComplete: (profile: UserProfile) => void;
}

export default function OnboardingScreen({ visible, onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTimezones = TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleComplete = async () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }

    const profile: UserProfile = {
      name: name.trim(),
      timezone,
    };

    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      onComplete(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentCenter}>
          <View style={styles.header}>
            <Text style={styles.title}>F.R.I.D.A.Y.</Text>
            <Text style={styles.subtitle}>Friendly and Reliable Interactive Digital Assistant for You</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>What&apos;s your name?</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                maxLength={50}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>What&apos;s your timezone?</Text>
              <TouchableOpacity
                style={styles.timezoneButton}
                onPress={() => setShowTimezoneModal(true)}
              >
                <Text style={styles.timezoneButtonText}>{timezone}</Text>
                <Text style={styles.timezoneIcon}>▼</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.completeButton, !name.trim() && styles.completeButtonDisabled]}
            onPress={handleComplete}
            disabled={!name.trim()}
          >
            <Text style={styles.completeButtonText}>Get Started</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Timezone Modal */}
        <Modal
          visible={showTimezoneModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowTimezoneModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Timezone</Text>
              <TouchableOpacity onPress={() => setShowTimezoneModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search timezone..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredTimezones}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.timezoneOption,
                    timezone === item && styles.timezoneOptionActive,
                  ]}
                  onPress={() => {
                    setTimezone(item);
                    setShowTimezoneModal(false);
                    setSearchQuery('');
                  }}
                >
                  <Text
                    style={[
                      styles.timezoneOptionText,
                      timezone === item && styles.timezoneOptionTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {timezone === item && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  content: {
    flex: 1,
  },
  contentCenter: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: ACCENT_GREEN,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginBottom: 40,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT_BLUE,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
    fontSize: 16,
  },
  timezoneButton: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
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
    color: ACCENT_BLUE,
    fontSize: 12,
  },
  completeButton: {
    backgroundColor: ACCENT_GREEN,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  completeButtonDisabled: {
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: ACCENT_BLUE,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ACCENT_GREEN,
    letterSpacing: 1,
  },
  modalClose: {
    fontSize: 28,
    color: ACCENT_BLUE,
    fontWeight: 'bold',
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
    borderColor: ACCENT_BLUE + '66',
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
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: ACCENT_GREEN,
  },
});
