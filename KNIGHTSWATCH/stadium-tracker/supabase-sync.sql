-- Stadium Trip Tracker — cloud sync schema
-- Run this once in the Supabase SQL Editor (safe to re-run).
--
-- Two tables, both scoped to the signed-in user via row-level security so
-- everyone only ever sees their own trips and photos.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── stadium_trips ──────────────────────────────────────────────────────
-- One row per (user, stadium). updated_at drives last-write-wins sync.
CREATE TABLE IF NOT EXISTS public.stadium_trips (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stadium_id TEXT NOT NULL,
  visited BOOLEAN NOT NULL DEFAULT FALSE,
  date TEXT NOT NULL DEFAULT '',
  rating SMALLINT NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  hotel TEXT NOT NULL DEFAULT '',
  flight TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stadium_id)
);

CREATE INDEX IF NOT EXISTS idx_stadium_trips_user ON public.stadium_trips(user_id);

-- ─── stadium_photos ─────────────────────────────────────────────────────
-- Photos are downscaled JPEG data URLs. id is client-generated (UUID) so the
-- same photo has one identity across devices.
CREATE TABLE IF NOT EXISTS public.stadium_photos (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stadium_id TEXT NOT NULL,
  data_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stadium_photos_user_stadium
  ON public.stadium_photos(user_id, stadium_id);

-- ─── Row level security ─────────────────────────────────────────────────
ALTER TABLE public.stadium_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadium_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own trips" ON public.stadium_trips;
CREATE POLICY "Users manage own trips"
  ON public.stadium_trips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own photos" ON public.stadium_photos;
CREATE POLICY "Users manage own photos"
  ON public.stadium_photos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
