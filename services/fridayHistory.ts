import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConversationRecord {
  id: string;
  timestamp: number;
  userMessage: string;
  fridayResponse: string;
  duration: number; // milliseconds
}

export interface ConversationSession {
  id: string;
  startedAt: number;
  records: ConversationRecord[];
}

const HISTORY_KEY = 'friday_conversation_history';
const SESSIONS_KEY = 'friday_conversation_sessions';

/**
 * Save a conversation record to the current session
 */
export const saveConversationRecord = async (
  sessionId: string,
  record: Omit<ConversationRecord, 'id'>
): Promise<ConversationRecord> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const sessions: ConversationSession[] = sessionsJson ? JSON.parse(sessionsJson) : [];

    const recordWithId: ConversationRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].records.push(recordWithId);
    } else {
      sessions.push({
        id: sessionId,
        startedAt: Date.now(),
        records: [recordWithId],
      });
    }

    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return recordWithId;
  } catch (error) {
    console.error('Error saving conversation record:', error);
    throw error;
  }
};

/**
 * Create a new conversation session
 */
export const createSession = async (): Promise<ConversationSession> => {
  const session: ConversationSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    startedAt: Date.now(),
    records: [],
  };

  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    const sessions: ConversationSession[] = sessionsJson ? JSON.parse(sessionsJson) : [];
    sessions.push(session);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error creating session:', error);
  }

  return session;
};

/**
 * Get all conversation sessions
 */
export const getAllSessions = async (): Promise<ConversationSession[]> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    return sessionsJson ? JSON.parse(sessionsJson) : [];
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
};

/**
 * Get a specific session by ID
 */
export const getSession = async (sessionId: string): Promise<ConversationSession | null> => {
  try {
    const sessions = await getAllSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  } catch (error) {
    console.error('Error loading session:', error);
    return null;
  }
};

/**
 * Search conversation history by keyword
 */
export const searchHistory = async (keyword: string): Promise<ConversationRecord[]> => {
  try {
    const sessions = await getAllSessions();
    const results: ConversationRecord[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const session of sessions) {
      for (const record of session.records) {
        if (
          record.userMessage.toLowerCase().includes(lowerKeyword) ||
          record.fridayResponse.toLowerCase().includes(lowerKeyword)
        ) {
          results.push(record);
        }
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Error searching history:', error);
    return [];
  }
};

/**
 * Resume a past session - returns all messages in conversation format
 */
export const resumeSession = async (
  sessionId: string
): Promise<{ id: string; role: 'user' | 'assistant'; content: string }[]> => {
  try {
    const session = await getSession(sessionId);
    if (!session) return [];

    return session.records.flatMap((record) => [
      {
        id: record.id,
        role: 'user' as const,
        content: record.userMessage,
      },
      {
        id: `${record.id}_response`,
        role: 'assistant' as const,
        content: record.fridayResponse,
      },
    ]);
  } catch (error) {
    console.error('Error resuming session:', error);
    return [];
  }
};

/**
 * Delete a session
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    let sessions: ConversationSession[] = sessionsJson ? JSON.parse(sessionsJson) : [];
    sessions = sessions.filter((s) => s.id !== sessionId);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error deleting session:', error);
  }
};

/**
 * Clear all history
 */
export const clearAllHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};
