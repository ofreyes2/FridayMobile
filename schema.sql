-- Friday Mobile Supabase Schema
-- Execute this SQL in the Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── friday_conversations ──────────────────────────────────────────────
-- Stores conversation messages between user and Friday
CREATE TABLE IF NOT EXISTS public.friday_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  source TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friday_conversations_user_id ON public.friday_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_friday_conversations_timestamp ON public.friday_conversations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_friday_conversations_user_timestamp ON public.friday_conversations(user_id, timestamp DESC);

-- ─── friday_memories ──────────────────────────────────────────────────
-- Stores Friday's learned memories and preferences about the user
CREATE TABLE IF NOT EXISTS public.friday_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preference', 'fact', 'learning')),
  content TEXT NOT NULL,
  relevance_score NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
  learned_at BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friday_memories_user_id ON public.friday_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_friday_memories_type ON public.friday_memories(type);
CREATE INDEX IF NOT EXISTS idx_friday_memories_relevance ON public.friday_memories(relevance_score DESC);

-- ─── friday_personalities ──────────────────────────────────────────────
-- Stores Friday's evolving personality traits per user
CREATE TABLE IF NOT EXISTS public.friday_personalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'F.R.I.D.A.Y.',
  traits TEXT[] NOT NULL DEFAULT '{}',
  communication_style TEXT NOT NULL DEFAULT 'professional',
  interests TEXT[] NOT NULL DEFAULT '{}',
  interaction_count INTEGER NOT NULL DEFAULT 0,
  warmth_level TEXT NOT NULL DEFAULT 'friendly' CHECK (warmth_level IN ('formal', 'professional', 'friendly', 'casual')),
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friday_personalities_user_id ON public.friday_personalities(user_id);

-- ─── friday_user_profiles ──────────────────────────────────────────────
-- Stores user profile information
CREATE TABLE IF NOT EXISTS public.friday_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  avatar_uri TEXT,
  first_message_at TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  total_messages INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_friday_user_profiles_created_at ON public.friday_user_profiles(created_at);

-- ─── RPC Functions ──────────────────────────────────────────────────────
-- Function to increment message count safely
CREATE OR REPLACE FUNCTION increment_message_count(user_id UUID, increment_by INTEGER DEFAULT 1)
RETURNS void AS $$
BEGIN
  UPDATE public.friday_user_profiles
  SET total_messages = total_messages + increment_by,
      updated_at = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Row Level Security (RLS) ──────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE public.friday_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friday_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friday_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friday_user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for friday_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.friday_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.friday_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.friday_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.friday_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for friday_memories
CREATE POLICY "Users can view their own memories"
  ON public.friday_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories"
  ON public.friday_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories"
  ON public.friday_memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories"
  ON public.friday_memories FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for friday_personalities
CREATE POLICY "Users can view their own personality"
  ON public.friday_personalities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own personality"
  ON public.friday_personalities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own personality"
  ON public.friday_personalities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for friday_user_profiles
CREATE POLICY "Users can view their own profile"
  ON public.friday_user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.friday_user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.friday_user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
