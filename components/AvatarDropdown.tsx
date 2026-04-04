import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface AvatarDropdownProps {
  session: Session | null;
}

export function AvatarDropdown({ session }: AvatarDropdownProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);

  const userEmail = session?.user?.email || 'User';
  const userName = session?.user?.user_metadata?.name || userEmail.split('@')[0];
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    setShowMenu(false);
    try {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleSettings = () => {
    setShowMenu(false);
    router.push('/(tabs)/settings');
  };

  return (
    <>
      <TouchableOpacity
        style={styles.avatar}
        onPress={() => setShowMenu(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.initials}>{initials}</Text>
      </TouchableOpacity>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.dropdownContainer}>
            {/* User Info */}
            <View style={styles.userInfoSection}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userEmail}>{userEmail}</Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleSettings}
              activeOpacity={0.7}
            >
              <Text style={styles.menuItemText}>⚙️ Settings</Text>
            </TouchableOpacity>

            {/* Sign Out */}
            <TouchableOpacity
              style={[styles.menuItem, styles.signOutItem]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <Text style={[styles.menuItemText, styles.signOutText]}>
                🚪 Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: 0.5,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  dropdownContainer: {
    backgroundColor: '#12121A',
    borderRadius: 12,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  userInfoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 12,
    color: '#888888',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E1E2E',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
  },
  signOutItem: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '500',
  },
  signOutText: {
    color: '#FF6B6B',
  },
});
