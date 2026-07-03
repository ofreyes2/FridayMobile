-- Flight discovery & alerts schema
-- Execute in the Supabase SQL Editor (safe to re-run).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── flight_alerts ──────────────────────────────────────────────────────
-- User-configured price alerts (route, cheapest-anywhere, or Southwest).
CREATE TABLE IF NOT EXISTS public.flight_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('route', 'cheapest_anywhere', 'southwest')),
  label TEXT NOT NULL DEFAULT '',
  origins TEXT[] NOT NULL DEFAULT '{}',
  destinations TEXT[] NOT NULL DEFAULT '{}',
  depart_date DATE NOT NULL,
  return_date DATE,
  max_price NUMERIC(10, 2) NOT NULL,
  airlines TEXT[] NOT NULL DEFAULT '{}',
  cabin TEXT NOT NULL DEFAULT 'economy'
    CHECK (cabin IN ('economy', 'premium_economy', 'business', 'first')),
  southwest_only BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_price NUMERIC(10, 2),
  last_checked_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flight_alerts_user ON public.flight_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_flight_alerts_active ON public.flight_alerts(is_active)
  WHERE is_active = TRUE;

-- ─── flight_price_history ───────────────────────────────────────────────
-- Time series of observed cheapest prices per route_key (origin>dest>date).
CREATE TABLE IF NOT EXISTS public.flight_price_history (
  id BIGSERIAL PRIMARY KEY,
  route_key TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_route
  ON public.flight_price_history(route_key, timestamp DESC);

-- ─── flight_preferences ─────────────────────────────────────────────────
-- Per-user default filters, home airports and notification channels.
CREATE TABLE IF NOT EXISTS public.flight_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_airports TEXT[] NOT NULL DEFAULT '{}',
  preferred_airlines TEXT[] NOT NULL DEFAULT '{}',
  default_cabin TEXT NOT NULL DEFAULT 'economy'
    CHECK (default_cabin IN ('economy', 'premium_economy', 'business', 'first')),
  max_price NUMERIC(10, 2),
  email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  push_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── flight_notifications ───────────────────────────────────────────────
-- Audit log of alert notifications (for throttling and history views).
CREATE TABLE IF NOT EXISTS public.flight_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES public.flight_alerts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'in_app')),
  price NUMERIC(10, 2),
  reason TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flight_notifications_user
  ON public.flight_notifications(user_id, sent_at DESC);

-- ─── Row level security ─────────────────────────────────────────────────
ALTER TABLE public.flight_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_price_history ENABLE ROW LEVEL SECURITY;

-- flight_alerts policies
DROP POLICY IF EXISTS "Users manage own alerts" ON public.flight_alerts;
CREATE POLICY "Users manage own alerts"
  ON public.flight_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- flight_preferences policies
DROP POLICY IF EXISTS "Users manage own preferences" ON public.flight_preferences;
CREATE POLICY "Users manage own preferences"
  ON public.flight_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- flight_notifications policies
DROP POLICY IF EXISTS "Users view own notifications" ON public.flight_notifications;
CREATE POLICY "Users view own notifications"
  ON public.flight_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- flight_price_history: price data is not user-scoped; allow authenticated
-- users to read history and insert observations (writes also happen from the
-- background worker using the service role, which bypasses RLS).
DROP POLICY IF EXISTS "Authenticated can read price history" ON public.flight_price_history;
CREATE POLICY "Authenticated can read price history"
  ON public.flight_price_history FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Authenticated can insert price history" ON public.flight_price_history;
CREATE POLICY "Authenticated can insert price history"
  ON public.flight_price_history FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);
