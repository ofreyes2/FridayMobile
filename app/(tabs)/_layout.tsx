import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { BottomNavigationBar } from '@/components/BottomNavigationBar';
import { NavigationDrawer } from '@/components/NavigationDrawer';
import { ProfileScreen } from '@/components/ProfileScreen';
import { DiscoverScreen } from '@/components/DiscoverScreen';
import { LibraryScreen } from '@/components/LibraryScreen';
import {
  getUserSessions,
  createSession,
  loadSessionMessages,
  Session as DBSession,
  groupSessionsByDate,
} from '@/lib/conversationService';
import type { Session as AuthSession } from '@supabase/supabase-js';

// Dynamic import of ChatScreen
import ChatScreenComponent from '@/app/(tabs)/chat';

type TabType = 'home' | 'discover' | 'library' | 'new';

export default function TabLayout() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('llama3.3:70b');
  const [currentSessionMessages, setCurrentSessionMessages] = useState<any[]>([]);

  // Load auth session
  useEffect(() => {
    const loadAuthSession = async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      setAuthSession(sess);
      if (sess) {
        loadUserSessions(sess.user.id);
      }
    };
    loadAuthSession();
  }, []);

  // Load user sessions
  const loadUserSessions = useCallback(async (userId: string) => {
    try {
      const userSessions = await getUserSessions(userId);
      setSessions(userSessions);
    } catch (err) {
      console.error('[TabLayout] Failed to load sessions:', err);
    }
  }, []);

  // Handle tab press
  const handleTabPress = useCallback(async (tab: TabType) => {
    if (tab === 'new') {
      // Create new session
      if (authSession?.user.id) {
        try {
          const newSession = await createSession(authSession.user.id, 'New Conversation');
          setCurrentSessionId(newSession.id);
          setCurrentSessionMessages([]);
          setSessions((prev) => [newSession, ...prev]);
          setActiveTab('home');
        } catch (err) {
          console.error('[TabLayout] Failed to create session:', err);
        }
      }
    } else {
      setActiveTab(tab);
    }
  }, [authSession?.user.id]);

  // Handle session selection
  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const messages = await loadSessionMessages(id);
      setCurrentSessionId(id);
      setCurrentSessionMessages(messages);
      setActiveTab('home');
    } catch (err) {
      console.error('[TabLayout] Failed to load session messages:', err);
    }
  }, []);

  // Handle new session from drawer
  const handleNewSession = useCallback(async () => {
    if (authSession?.user.id) {
      try {
        const newSession = await createSession(authSession.user.id, 'New Conversation');
        setCurrentSessionId(newSession.id);
        setCurrentSessionMessages([]);
        setSessions((prev) => [newSession, ...prev]);
        setActiveTab('home');
      } catch (err) {
        console.error('[TabLayout] Failed to create session:', err);
      }
    }
  }, [authSession?.user.id]);

  return (
    <View style={styles.container}>
      {/* Main Content */}
      <View style={styles.content}>
        {activeTab === 'home' && (
          <ChatScreenComponent />
        )}
        {activeTab === 'discover' && <DiscoverScreen />}
        {activeTab === 'library' && <LibraryScreen />}
      </View>

      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeTab={activeTab}
        onTabPress={handleTabPress}
        onHamburgerPress={() => setIsDrawerOpen(true)}
      />

      {/* Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onProfilePress={() => {
          setIsDrawerOpen(false);
          setShowProfileModal(true);
        }}
        session={authSession}
      />

      {/* Profile Modal */}
      <ProfileScreen
        isVisible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        session={authSession}
        currentModel={selectedModel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    flex: 1,
  },
});
