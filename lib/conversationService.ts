import { supabase } from './supabase';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  fileName?: string;
  fileContent?: string;
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  messages: Message[];
}

export interface GroupedConversations {
  today: ConversationSession[];
  yesterday: ConversationSession[];
  past7days: ConversationSession[];
  older: ConversationSession[];
}

/**
 * Create a new conversation session in Supabase
 */
export async function createConversation(
  userId: string,
  title: string = 'New conversation'
): Promise<ConversationSession> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .insert({
      user_id: userId,
      title,
      messages: [],
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[conversationService] Failed to create conversation:', error);
    throw error;
  }

  return data as ConversationSession;
}

/**
 * Load a conversation by ID
 */
export async function loadConversation(
  conversationId: string
): Promise<ConversationSession | null> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error) {
    console.error('[conversationService] Failed to load conversation:', error);
    return null;
  }

  return data as ConversationSession;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_sessions')
    .update({ title })
    .eq('id', conversationId);

  if (error) {
    console.error('[conversationService] Failed to update title:', error);
    throw error;
  }
}

/**
 * Save a message to a conversation
 */
export async function saveMessage(
  conversationId: string,
  message: Message
): Promise<void> {
  // Get current conversation
  const conversation = await loadConversation(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Add message to array
  const updatedMessages = [...(conversation.messages || []), message];

  // Auto-generate title if this is the first user message
  let title = conversation.title;
  if (title === 'New conversation' && message.role === 'user') {
    title = autoGenerateTitle(message.content);
  }

  // Update conversation with new messages
  const { error } = await supabase
    .from('conversation_sessions')
    .update({
      messages: updatedMessages,
      title,
      last_message_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (error) {
    console.error('[conversationService] Failed to save message:', error);
    throw error;
  }
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_sessions')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('[conversationService] Failed to delete conversation:', error);
    throw error;
  }
}

/**
 * Get all conversations for a user
 */
export async function getAllConversations(
  userId: string
): Promise<ConversationSession[]> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('[conversationService] Failed to fetch conversations:', error);
    return [];
  }

  return (data as ConversationSession[]) || [];
}

/**
 * Group conversations by date
 */
export function groupConversationsByDate(
  conversations: ConversationSession[]
): GroupedConversations {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const grouped: GroupedConversations = {
    today: [],
    yesterday: [],
    past7days: [],
    older: [],
  };

  conversations.forEach((conv) => {
    const convDate = new Date(conv.last_message_at);
    const convDateOnly = new Date(
      convDate.getFullYear(),
      convDate.getMonth(),
      convDate.getDate()
    );

    if (convDateOnly.getTime() === today.getTime()) {
      grouped.today.push(conv);
    } else if (convDateOnly.getTime() === yesterday.getTime()) {
      grouped.yesterday.push(conv);
    } else if (convDateOnly.getTime() >= sevenDaysAgo.getTime()) {
      grouped.past7days.push(conv);
    } else {
      grouped.older.push(conv);
    }
  });

  return grouped;
}

/**
 * Auto-generate conversation title from first message
 * Takes first 40 characters, truncates with "..."
 */
export function autoGenerateTitle(firstMessage: string): string {
  const maxLength = 40;
  if (firstMessage.length <= maxLength) {
    return firstMessage;
  }
  return firstMessage.substring(0, maxLength) + '...';
}

/**
 * Format a date for display in conversation list
 */
export function formatConversationDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // Today
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }

  // This week
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (date > sevenDaysAgo) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Older
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
