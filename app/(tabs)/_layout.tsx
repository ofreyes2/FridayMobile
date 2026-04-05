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
  getAllConversations,
  createConversation,
  ConversationSession,
} from '@/lib/conversationService';
import type { Session } from '@supabase/supabase-js';

// Dynamic import of ChatScreen
import ChatScreenComponent from '@/app/(tabs)/chat';

type TabType = 'home' | 'discover' | 'library' | 'new';

export default function TabLayout() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('llama3.3:70b');

  // Load session
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      setSession(sess);
      if (sess) {
        loadConversations(sess.user.id);
      }
    };
    loadSession();
  }, []);

  // Load conversations
  const loadConversations = useCallback(async (userId: string) => {
    try {
      const convs = await getAllConversations(userId);
      setConversations(convs);
    } catch (err) {
      console.error('[TabLayout] Failed to load conversations:', err);
    }
  }, []);

  // Handle tab press
  const handleTabPress = useCallback(async (tab: TabType) => {
    if (tab === 'new') {
      // Create new conversation
      if (session?.user.id) {
        try {
          const newConv = await createConversation(session.user.id, 'New conversation');
          setCurrentConversationId(newConv.id);
          setConversations((prev) => [newConv, ...prev]);
          setActiveTab('home');
        } catch (err) {
          console.error('[TabLayout] Failed to create conversation:', err);
        }
      }
    } else {
      setActiveTab(tab);
    }
  }, [session?.user.id]);

  // Handle conversation selection
  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    setActiveTab('home');
  }, []);

  // Handle new conversation from drawer
  const handleNewConversation = useCallback(async () => {
    if (session?.user.id) {
      try {
        const newConv = await createConversation(session.user.id, 'New conversation');
        setCurrentConversationId(newConv.id);
        setConversations((prev) => [newConv, ...prev]);
        setActiveTab('home');
      } catch (err) {
        console.error('[TabLayout] Failed to create conversation:', err);
      }
    }
  }, [session?.user.id]);

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
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onProfilePress={() => {
          setIsDrawerOpen(false);
          setShowProfileModal(true);
        }}
        session={session}
      />

      {/* Profile Modal */}
      <ProfileScreen
        isVisible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        session={session}
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
