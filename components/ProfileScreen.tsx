import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  PanResponder,
  Animated,
  GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { fetchOllamaModels } from '@/services/ollamaModels';

interface ProfileScreenProps {
  isVisible: boolean;
  onClose: () => void;
  session: AuthSession | null;
  currentModel: string;
  onModelChange?: (model: string) => void;
}

interface OllamaModel {
  name: string;
  model: string;
  size?: number;
}

export function ProfileScreen({
  isVisible,
  onClose,
  session,
  currentModel,
  onModelChange,
}: ProfileScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const panResponderRef = useRef<any>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(currentModel);

  // Setup pan responder for swipe down to dismiss
  useEffect(() => {
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 10; // Detect downward swipe
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          // Swipe down distance threshold
          onClose();
        }
      },
    });
    panResponderRef.current = panResponder;
  }, [onClose]);

  const userName = session?.user?.user_metadata?.name ||
                   session?.user?.email?.split('@')[0] ||
                   'User';
  const userEmail = session?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  const getModelType = (modelName: string): string => {
    const lower = modelName.toLowerCase();
    if (lower.includes('vision') || lower.includes('llava') || lower.includes('moondream') || lower.includes('qwen-vl')) {
      return 'Vision';
    }
    if (lower.includes('coder') || lower.includes('code') || lower.includes('deep') || lower.includes('claude')) {
      return 'Coding';
    }
    return 'General';
  };

  const formatModelSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes >= 1e9) {
      return `${(bytes / 1e9).toFixed(1)}B`;
    }
    if (bytes >= 1e6) {
      return `${(bytes / 1e6).toFixed(1)}M`;
    }
    return `${(bytes / 1e3).toFixed(1)}K`;
  };

  const loadAvailableModels = async () => {
    try {
      const models = await fetchOllamaModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('[ProfileScreen] Failed to fetch models:', error);
      Alert.alert('Error', 'Failed to fetch available models');
    }
  };

  const handleModelSelect = async (model: string) => {
    try {
      setSelectedModel(model);
      await AsyncStorage.setItem('selectedModel', model);
      if (onModelChange) {
        onModelChange(model);
      }
      setShowModelPicker(false);
    } catch (error) {
      console.error('[ProfileScreen] Failed to save model:', error);
      Alert.alert('Error', 'Failed to save model selection');
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Sign Out',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            onClose();
            router.replace('/auth/login');
          } catch (err) {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const menuItems = [
    { id: 'account', icon: '👤', label: 'Account', onPress: () => {} },
    { id: 'preferences', icon: '⚙️', label: 'Preferences', onPress: () => {} },
    { id: 'voice', icon: '🎤', label: 'Voice Settings', onPress: () => {} },
    { id: 'memory', icon: '🧠', label: 'Memory', onPress: () => {} },
    {
      id: 'model',
      icon: '🤖',
      label: 'AI Model',
      onPress: () => {
        loadAvailableModels();
        setShowModelPicker(true);
      },
      value: selectedModel.split(':')[0],
    },
    { id: 'knightswatch', icon: '👁️', label: 'KNIGHTSWATCH Status', onPress: () => {} },
    { id: 'feedback', icon: '💬', label: 'Give Feedback', onPress: () => {} },
    { id: 'about', icon: 'ℹ️', label: 'About', onPress: () => {} },
  ];

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      {/* Main container with pan responder for swipe down */}
      <View
        style={styles.container}
        {...(panResponderRef.current?.panHandlers || {})}
      >
        {/* Header with safe area insets */}
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.spacer} />
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar & User Info */}
          <View style={styles.userSection}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarInitial}>{userInitial}</Text>
            </View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <View style={styles.menuItemRight}>
                  {item.value && (
                    <Text style={styles.menuValue}>{item.value}</Text>
                  )}
                  <Text style={styles.menuArrow}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutIcon}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          {/* Footer Links */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Privacy · Terms · FAQ</Text>
          </View>
        </ScrollView>

        {/* Model Picker Modal */}
        <Modal
          visible={showModelPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModelPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modelPickerSheet, { paddingTop: insets.top + 20 }]}>
              {/* Header */}
              <View style={styles.modelPickerHeader}>
                <TouchableOpacity
                  style={styles.modelCloseButton}
                  onPress={() => setShowModelPicker(false)}
                  hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <Text style={styles.modelCloseIcon}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modelPickerTitle}>Select AI Model</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Models List */}
              <ScrollView
                style={styles.modelsList}
                showsVerticalScrollIndicator={false}
              >
                {availableModels.map((model) => (
                  <TouchableOpacity
                    key={model.model}
                    style={styles.modelItem}
                    onPress={() => handleModelSelect(model.model)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modelItemLeft}>
                      <Text style={styles.modelName}>{model.name}</Text>
                      <View style={styles.modelMeta}>
                        {model.size && (
                          <Text style={styles.modelSize}>{formatModelSize(model.size)}</Text>
                        )}
                        <Text style={styles.modelType}>{getModelType(model.model)}</Text>
                      </View>
                    </View>
                    {selectedModel === model.model && (
                      <Text style={styles.modelCheckmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
  },
  closeButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 24,
    color: '#5A5A7A',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  spacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0A0A0F',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: '#8888AA',
  },
  menuSection: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#12121A',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuValue: {
    fontSize: 13,
    color: '#00D4FF',
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 18,
    color: '#5A5A7A',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#FF6B6B20',
    gap: 12,
  },
  signOutIcon: {
    fontSize: 20,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#5A5A7A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000040',
    justifyContent: 'flex-end',
  },
  modelPickerSheet: {
    backgroundColor: '#12121A',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modelPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
  },
  modelCloseButton: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelCloseIcon: {
    fontSize: 20,
    color: '#5A5A7A',
    fontWeight: '600',
  },
  modelPickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modelsList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: '#1A1A22',
    minHeight: 64,
  },
  modelItemLeft: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  modelMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  modelSize: {
    fontSize: 11,
    color: '#8888AA',
  },
  modelType: {
    fontSize: 11,
    color: '#00D4FF',
    fontWeight: '500',
    backgroundColor: '#00D4FF20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modelCheckmark: {
    fontSize: 20,
    color: '#00D4FF',
    fontWeight: '700',
    marginLeft: 12,
  },
});
