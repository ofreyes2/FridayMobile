import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  GestureResponderEvent,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Session as DBSession, groupSessionsByDate, GroupedSessions } from '@/lib/conversationService';
import type { Session as AuthSession } from '@supabase/supabase-js';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: DBSession[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onProfilePress: () => void;
  session: AuthSession | null;
}

export function NavigationDrawer({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onNewSession,
  onProfilePress,
  session,
}: NavigationDrawerProps) {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const drawerWidth = screenWidth * 0.82;
  const slideAnim = React.useRef(new Animated.Value(-drawerWidth)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, slideAnim, drawerWidth]);

  const grouped = groupSessionsByDate(sessions);
  const userName = session?.user?.user_metadata?.name ||
                   session?.user?.email?.split('@')[0] ||
                   'User';
  const userEmail = session?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  const handleOverlayPress = () => {
    onClose();
  };

  const renderSessionSection = (
    title: string,
    sessionsData: DBSession[]
  ) => {
    if (sessionsData.length === 0) return null;

    return (
      <View key={title} style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {sessionsData.map((sess) => (
          <TouchableOpacity
            key={sess.id}
            style={styles.sessionItem}
            onPress={() => {
              onSelectSession(sess.id);
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {sess.title}
            </Text>
            <Text style={styles.sessionMeta}>
              {sess.message_count} message{sess.message_count !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Overlay */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleOverlayPress}
      />

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>F.R.I.D.A.Y.</Text>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => {
              onNewSession();
              onClose();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Sessions List */}
        <ScrollView
          style={styles.sessionsList}
          contentContainerStyle={sessions.length === 0 ? styles.scrollContentCentered : undefined}
          showsVerticalScrollIndicator={false}
        >
          {renderSessionSection('Today', grouped.today)}
          {renderSessionSection('Yesterday', grouped.yesterday)}
          {renderSessionSection('Past 7 days', grouped.past7days)}
          {renderSessionSection('Older', grouped.older)}

          {sessions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No conversations yet</Text>
              <Text style={styles.emptyStateHint}>Start a new conversation to get started</Text>
            </View>
          )}
        </ScrollView>

        {/* User Profile Section (Bottom) */}
        <TouchableOpacity
          style={styles.profileSection}
          onPress={onProfilePress}
          activeOpacity={0.7}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>{userInitial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {userEmail}
            </Text>
          </View>
          <Text style={styles.profileArrow}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%', // width is set dynamically in render
    backgroundColor: '#12121A',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: '#1E1E2E',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2E',
    backgroundColor: '#0A0A0F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#00D4FF',
    textTransform: 'uppercase',
  },
  newButton: {
    backgroundColor: '#00D4FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A0A0F',
  },
  sessionsList: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5A5A7A',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 12,
    letterSpacing: 0.5,
  },
  sessionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#1A1A22',
    minHeight: 48,
    justifyContent: 'center',
  },
  sessionTitle: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sessionMeta: {
    fontSize: 11,
    color: '#5A5A7A',
    marginTop: 2,
  },
  scrollContentCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#8888AA',
    fontWeight: '500',
    marginBottom: 4,
  },
  emptyStateHint: {
    fontSize: 12,
    color: '#5A5A7A',
    fontStyle: 'italic',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 64,
    borderTopWidth: 1,
    borderTopColor: '#1E1E2E',
    gap: 12,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0F',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 11,
    color: '#8888AA',
  },
  profileArrow: {
    fontSize: 18,
    color: '#5A5A7A',
  },
});
