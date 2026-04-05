import { supabase } from './supabase';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageBase64?: string;
  fileName?: string;
  fileContent?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  message_count: number;
}

export interface GroupedSessions {
  today: Session[];
  yesterday: Session[];
  past7days: Session[];
  older: Session[];
}

/**
 * Create a new conversation session
 */
export async function createSession(
  userId: string,
  title: string = 'New Conversation'
): Promise<Session> {
  const { data, error } = await supabase
    .from('friday_sessions')
    .insert({
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      message_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('[conversationService] Failed to create session:', error);
    throw error;
  }

  return data as Session;
}

/**
 * Load a session by ID
 */
export async function loadSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('friday_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('[conversationService] Failed to load session:', error);
    return null;
  }

  return data as Session;
}

/**
 * Load all messages for a session
 */
export async function loadSessionMessages(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('friday_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[conversationService] Failed to load messages:', error);
    return [];
  }

  return (data || []).map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    imageBase64: msg.image_base64,
    fileName: msg.file_name,
    fileContent: msg.file_content,
    created_at: msg.created_at,
  })) as Message[];
}

/**
 * Save a message to a session
 */
export async function saveMessage(
  sessionId: string,
  userId: string,
  message: Message
): Promise<void> {
  // Insert message
  const { error: insertError } = await supabase
    .from('friday_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role: message.role,
      content: message.content,
      image_base64: message.imageBase64,
      file_name: message.fileName,
      file_content: message.fileContent,
      created_at: message.created_at,
    });

  if (insertError) {
    console.error('[conversationService] Failed to save message:', insertError);
    throw insertError;
  }

  // Update session's last_message_at and message_count
  const { error: updateError } = await supabase
    .from('friday_sessions')
    .update({
      last_message_at: new Date().toISOString(),
      message_count: supabase.rpc('increment_message_count', { session_id: sessionId }),
    })
    .eq('id', sessionId);

  if (updateError) {
    console.error('[conversationService] Failed to update session:', updateError);
  }
}

/**
 * Update session title
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('friday_sessions')
    .update({ title })
    .eq('id', sessionId);

  if (error) {
    console.error('[conversationService] Failed to update title:', error);
    throw error;
  }
}

/**
 * Delete a session and its messages
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('friday_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('[conversationService] Failed to delete session:', error);
    throw error;
  }
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(userId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from('friday_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('[conversationService] Failed to fetch sessions:', error);
    return [];
  }

  return (data as Session[]) || [];
}

/**
 * Group sessions by date
 */
export function groupSessionsByDate(sessions: Session[]): GroupedSessions {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const grouped: GroupedSessions = {
    today: [],
    yesterday: [],
    past7days: [],
    older: [],
  };

  sessions.forEach((session) => {
    const sessionDate = new Date(session.last_message_at);
    const sessionDateOnly = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      sessionDate.getDate()
    );

    if (sessionDateOnly.getTime() === today.getTime()) {
      grouped.today.push(session);
    } else if (sessionDateOnly.getTime() === yesterday.getTime()) {
      grouped.yesterday.push(session);
    } else if (sessionDateOnly.getTime() >= sevenDaysAgo.getTime()) {
      grouped.past7days.push(session);
    } else {
      grouped.older.push(session);
    }
  });

  return grouped;
}

/**
 * Auto-generate session title from first message
 */
export function autoGenerateTitle(firstMessage: string): string {
  const maxLength = 40;
  if (firstMessage.length <= maxLength) {
    return firstMessage;
  }
  return firstMessage.substring(0, maxLength) + '...';
}

/**
 * Format a date for display in session list
 */
export function formatSessionDate(dateString: string): string {
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
