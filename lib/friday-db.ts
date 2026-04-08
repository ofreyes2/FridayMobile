/**
 * Friday Database Access Layer
 * Handles all CRUD operations for Friday data in Supabase
 */

import { supabase } from './supabase';
import type {
  FridayConversationRow,
  FridayConversationInsert,
  FridayMemoryRow,
  FridayMemoryInsert,
  FridayPersonalityRow,
  FridayPersonalityInsert,
  FridayUserProfileRow,
  FridayUserProfileInsert,
} from './friday-db-types';

// ─── Conversations ────────────────────────────────────────────────────

export const conversationsDB = {
  fetchAll: async (userId: string, limit: number = 100): Promise<FridayConversationRow[]> => {
    try {
      const { data, error } = await supabase
        .from('friday_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[conversationsDB.fetchAll]', error.message);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('[conversationsDB.fetchAll] exception:', e);
      return [];
    }
  },

  upsert: async (userId: string, conversation: FridayConversationInsert): Promise<void> => {
    try {
      const { error } = await supabase
        .from('friday_conversations')
        .upsert(
          {
            ...conversation,
            user_id: userId,
          },
          { onConflict: 'id' }
        );

      if (error) console.error('[conversationsDB.upsert]', error.message);
    } catch (e) {
      console.error('[conversationsDB.upsert] exception:', e);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('friday_conversations')
        .delete()
        .eq('id', id);

      if (error) console.error('[conversationsDB.delete]', error.message);
    } catch (e) {
      console.error('[conversationsDB.delete] exception:', e);
    }
  },
};

// ─── Memories ─────────────────────────────────────────────────────────

export const memoriesDB = {
  fetchAll: async (userId: string, limit: number = 100): Promise<FridayMemoryRow[]> => {
    try {
      const { data, error } = await supabase
        .from('friday_memories')
        .select('*')
        .eq('user_id', userId)
        .order('learned_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[memoriesDB.fetchAll]', error.message);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('[memoriesDB.fetchAll] exception:', e);
      return [];
    }
  },

  fetchByType: async (
    userId: string,
    type: 'user' | 'feedback' | 'project' | 'reference' | 'preference' | 'fact' | 'learning'
  ): Promise<FridayMemoryRow[]> => {
    try {
      const { data, error } = await supabase
        .from('friday_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .order('learned_at', { ascending: false });

      if (error) {
        console.error('[memoriesDB.fetchByType]', error.message);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error('[memoriesDB.fetchByType] exception:', e);
      return [];
    }
  },

  upsert: async (userId: string, memory: FridayMemoryInsert): Promise<void> => {
    try {
      const { error } = await supabase
        .from('friday_memories')
        .upsert(
          {
            ...memory,
            user_id: userId,
          },
          { onConflict: 'id' }
        );

      if (error) console.error('[memoriesDB.upsert]', error.message);
    } catch (e) {
      console.error('[memoriesDB.upsert] exception:', e);
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('friday_memories')
        .delete()
        .eq('id', id);

      if (error) console.error('[memoriesDB.delete]', error.message);
    } catch (e) {
      console.error('[memoriesDB.delete] exception:', e);
    }
  },
};

// ─── Personalities ────────────────────────────────────────────────────

export const personalitiesDB = {
  fetch: async (userId: string): Promise<FridayPersonalityRow | null> => {
    try {
      const { data, error } = await supabase
        .from('friday_personalities')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows found - return null instead of error
        return null;
      }

      if (error) {
        console.error('[personalitiesDB.fetch]', error.message);
        return null;
      }

      return data || null;
    } catch (e) {
      console.error('[personalitiesDB.fetch] exception:', e);
      return null;
    }
  },

  upsert: async (userId: string, personality: FridayPersonalityInsert): Promise<void> => {
    try {
      const { error } = await supabase
        .from('friday_personalities')
        .upsert(
          {
            ...personality,
            user_id: userId,
          },
          { onConflict: 'user_id' }
        );

      if (error) console.error('[personalitiesDB.upsert]', error.message);
    } catch (e) {
      console.error('[personalitiesDB.upsert] exception:', e);
    }
  },
};

// ─── User Profiles ────────────────────────────────────────────────────

export const userProfilesDB = {
  fetch: async (userId: string): Promise<FridayUserProfileRow | null> => {
    try {
      const { data, error } = await supabase
        .from('friday_user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        return null;
      }

      if (error) {
        console.error('[userProfilesDB.fetch]', error.message);
        return null;
      }

      return data || null;
    } catch (e) {
      console.error('[userProfilesDB.fetch] exception:', e);
      return null;
    }
  },

  create: async (userId: string, profile: FridayUserProfileInsert): Promise<void> => {
    try {
      const { error } = await supabase.from('friday_user_profiles').insert({
        ...profile,
        id: userId,
      });

      if (error) console.error('[userProfilesDB.create]', error.message);
    } catch (e) {
      console.error('[userProfilesDB.create] exception:', e);
    }
  },

  upsert: async (userId: string, profile: FridayUserProfileInsert): Promise<void> => {
    try {
      const { error } = await supabase.from('friday_user_profiles').upsert(
        {
          ...profile,
          id: userId,
        },
        { onConflict: 'id' }
      );

      if (error) console.error('[userProfilesDB.upsert]', error.message);
    } catch (e) {
      console.error('[userProfilesDB.upsert] exception:', e);
    }
  },

  updateMessageCount: async (userId: string, increment: number = 1): Promise<void> => {
    try {
      const { error } = await supabase.rpc('increment_message_count', {
        user_id: userId,
        increment_by: increment,
      });

      if (error) {
        console.error('[userProfilesDB.updateMessageCount]', error.message);
      }
    } catch (e) {
      console.error('[userProfilesDB.updateMessageCount] exception:', e);
    }
  },
};
