/**
 * Supabase Type Definitions for Friday
 * Auto-generated structure matching friday_* tables
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// ─── friday_conversations ─────────────────────────────────────────────
export interface FridayConversationRow {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  model_used: string;
  timestamp: number;
  source?: string;
  tokens_used?: number;
  created_at: string;
  updated_at: string;
}

export type FridayConversationInsert = Omit<
  FridayConversationRow,
  'created_at' | 'updated_at'
> & {
  created_at?: string;
  updated_at?: string;
};

export type FridayConversationUpdate = Partial<FridayConversationInsert>;

// ─── friday_memories ──────────────────────────────────────────────────
export interface FridayMemoryRow {
  id: string;
  user_id: string;
  type: 'user' | 'feedback' | 'project' | 'reference' | 'preference' | 'fact' | 'learning';
  content: string;
  relevance_score: number;
  learned_at: number;
  created_at: string;
  updated_at: string;
}

export type FridayMemoryInsert = Omit<FridayMemoryRow, 'created_at' | 'updated_at'> & {
  created_at?: string;
  updated_at?: string;
};

export type FridayMemoryUpdate = Partial<FridayMemoryInsert>;

// ─── friday_personalities ──────────────────────────────────────────────
export interface FridayPersonalityRow {
  id: string;
  user_id: string;
  name: string;
  traits: string[];
  communication_style: string;
  interests: string[];
  interaction_count: number;
  warmth_level: string;
  last_interaction_at?: string;
  created_at: string;
  updated_at: string;
}

export type FridayPersonalityInsert = Omit<
  FridayPersonalityRow,
  'created_at' | 'updated_at'
> & {
  created_at?: string;
  updated_at?: string;
};

export type FridayPersonalityUpdate = Partial<FridayPersonalityInsert>;

// ─── friday_user_profiles ─────────────────────────────────────────────
export interface FridayUserProfileRow {
  id: string;
  name?: string;
  timezone: string;
  avatar_uri?: string;
  first_message_at?: string;
  last_message_at?: string;
  total_messages: number;
  created_at: string;
  updated_at: string;
}

export type FridayUserProfileInsert = Omit<
  FridayUserProfileRow,
  'created_at' | 'updated_at'
> & {
  created_at?: string;
  updated_at?: string;
};

export type FridayUserProfileUpdate = Partial<FridayUserProfileInsert>;
