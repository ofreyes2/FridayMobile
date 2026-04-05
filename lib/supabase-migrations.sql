-- Create friday_sessions table for conversation persistence
CREATE TABLE IF NOT EXISTS public.friday_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0
);

-- Create messages table linked to sessions
CREATE TABLE IF NOT EXISTS public.friday_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.friday_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_base64 TEXT,
  file_name TEXT,
  file_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sessions
ALTER TABLE public.friday_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on messages
ALTER TABLE public.friday_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON public.friday_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.friday_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.friday_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.friday_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their sessions"
  ON public.friday_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert messages in their sessions"
  ON public.friday_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update messages in their sessions"
  ON public.friday_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete messages in their sessions"
  ON public.friday_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_friday_sessions_user_id ON public.friday_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_friday_sessions_created_at ON public.friday_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friday_sessions_last_message ON public.friday_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_friday_sessions_user_created ON public.friday_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friday_messages_session_id ON public.friday_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_friday_messages_user_id ON public.friday_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_friday_messages_created_at ON public.friday_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_friday_messages_session_created ON public.friday_messages(session_id, created_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friday_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friday_messages TO authenticated;
