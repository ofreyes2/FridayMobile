/**
 * Flight price alerts.
 *
 * CRUD for user alerts backed by Supabase (`flight_alerts`), plus price-history
 * recording (`flight_price_history`) and the `evaluateAlert` logic that a
 * background worker (Supabase Edge Function / cron) or an in-app foreground
 * refresh runs to decide whether an alert should fire. The same evaluation is
 * reused everywhere so client and worker behave identically.
 */

import { supabase } from '@/lib/supabase';
import { airportLabel } from './airports';
import { cheapestAnywhere, searchFlights } from './flightService';
import type {
  Alert,
  AlertEvaluation,
  FlightResult,
  NewAlert,
  PricePoint,
  UserFlightPreferences,
} from './types';

const ALERTS_TABLE = 'flight_alerts';
const HISTORY_TABLE = 'flight_price_history';
const PREFS_TABLE = 'flight_preferences';

// ─── Row mapping ────────────────────────────────────────────────────────

interface AlertRow {
  id: string;
  user_id: string;
  kind: Alert['kind'];
  label: string;
  origins: string[];
  destinations: string[];
  depart_date: string;
  return_date: string | null;
  max_price: number;
  airlines: string[];
  cabin: Alert['cabin'];
  southwest_only: boolean;
  is_active: boolean;
  last_price: number | null;
  last_checked_at: string | null;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToAlert(r: AlertRow): Alert {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    label: r.label,
    origins: r.origins ?? [],
    destinations: r.destinations ?? [],
    departDate: r.depart_date,
    returnDate: r.return_date ?? undefined,
    maxPrice: r.max_price,
    airlines: r.airlines ?? [],
    cabin: r.cabin,
    southwestOnly: r.southwest_only,
    isActive: r.is_active,
    lastPrice: r.last_price ?? undefined,
    lastCheckedAt: r.last_checked_at ?? undefined,
    lastTriggeredAt: r.last_triggered_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Build a friendly label from an alert's shape. */
export function describeAlert(a: NewAlert): string {
  const origin = a.origins.length ? a.origins.map(airportLabel).join('/') : 'Anywhere';
  const price = `under $${a.maxPrice}`;
  if (a.kind === 'cheapest_anywhere') return `Cheapest from ${origin} ${price}`;
  if (a.kind === 'southwest') return `Southwest from ${origin} ${price}`;
  const dest = a.destinations.length ? a.destinations.map(airportLabel).join('/') : 'Anywhere';
  return `${origin} → ${dest} ${price}`;
}

// ─── CRUD ───────────────────────────────────────────────────────────────

export async function listAlerts(userId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as AlertRow[]).map(rowToAlert);
}

export async function createAlert(userId: string, alert: NewAlert): Promise<Alert> {
  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .insert({
      user_id: userId,
      kind: alert.kind,
      label: alert.label || describeAlert(alert),
      origins: alert.origins,
      destinations: alert.destinations,
      depart_date: alert.departDate,
      return_date: alert.returnDate ?? null,
      max_price: alert.maxPrice,
      airlines: alert.airlines,
      cabin: alert.cabin,
      southwest_only: alert.southwestOnly,
      is_active: alert.isActive,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlert(data as AlertRow);
}

export async function updateAlert(
  id: string,
  patch: Partial<NewAlert>,
): Promise<Alert> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label != null) payload.label = patch.label;
  if (patch.origins != null) payload.origins = patch.origins;
  if (patch.destinations != null) payload.destinations = patch.destinations;
  if (patch.departDate != null) payload.depart_date = patch.departDate;
  if (patch.returnDate !== undefined) payload.return_date = patch.returnDate ?? null;
  if (patch.maxPrice != null) payload.max_price = patch.maxPrice;
  if (patch.airlines != null) payload.airlines = patch.airlines;
  if (patch.cabin != null) payload.cabin = patch.cabin;
  if (patch.southwestOnly != null) payload.southwest_only = patch.southwestOnly;
  if (patch.isActive != null) payload.is_active = patch.isActive;

  const { data, error } = await supabase
    .from(ALERTS_TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return rowToAlert(data as AlertRow);
}

export async function toggleAlert(id: string, isActive: boolean): Promise<Alert> {
  return updateAlert(id, { isActive });
}

export async function deleteAlert(id: string): Promise<void> {
  const { error } = await supabase.from(ALERTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ─── Price history ──────────────────────────────────────────────────────

export function routeKey(origin: string, destination: string, date: string): string {
  return `${origin}>${destination}>${date}`;
}

export async function recordPrice(point: PricePoint): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE).insert({
    route_key: point.routeKey,
    price: point.price,
    timestamp: point.timestamp,
  });
  if (error) throw error;
}

export async function getPriceHistory(
  key: string,
  limit = 60,
): Promise<PricePoint[]> {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('route_key, price, timestamp')
    .eq('route_key', key)
    .order('timestamp', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as { route_key: string; price: number; timestamp: string }[]).map((r) => ({
    routeKey: r.route_key,
    price: r.price,
    timestamp: r.timestamp,
  }));
}

// ─── Evaluation (worker logic) ──────────────────────────────────────────

/**
 * Find the cheapest current itinerary matching an alert.
 * Returns the FlightResult and its price, or null if nothing matched.
 */
async function cheapestForAlert(
  alert: Alert,
): Promise<{ price: number; itinerary?: FlightResult } | null> {
  const filters = {
    airlines: alert.airlines,
    cabin: alert.cabin,
    maxPrice: undefined,
    southwestOnly: alert.southwestOnly || alert.kind === 'southwest',
  };

  if (alert.kind === 'cheapest_anywhere' || alert.destinations.length === 0) {
    const dests = await cheapestAnywhere({
      origins: alert.origins,
      departDate: alert.departDate,
      passengers: { adults: 1, children: 0 },
      filters,
      limit: 1,
    });
    const best = dests[0];
    if (!best) return null;
    return { price: best.price };
  }

  const res = await searchFlights({
    origins: alert.origins,
    destinations: alert.destinations,
    departDate: alert.departDate,
    returnDate: alert.returnDate,
    passengers: { adults: 1, children: 0 },
    filters,
  });
  const best = res.results[0];
  if (!best) return null;
  return { price: best.totalPrice, itinerary: best };
}

/**
 * Evaluate a single alert against live prices. Records a price-history point
 * and decides whether the alert should trigger a notification.
 *
 * Triggers when: current price ≤ threshold, OR a new all-time low appears
 * (below the previously observed lowest price).
 */
export async function evaluateAlert(alert: Alert): Promise<AlertEvaluation> {
  const found = await cheapestForAlert(alert);
  const checkedAt = new Date().toISOString();

  if (!found) {
    return { alert, currentPrice: Infinity, triggered: false };
  }

  const currentPrice = found.price;
  const previousPrice = alert.lastPrice;

  // Persist observation for the trend chart / history.
  const key = routeKey(
    alert.origins[0] ?? 'ANY',
    alert.destinations[0] ?? 'ANY',
    alert.departDate,
  );
  try {
    await recordPrice({ routeKey: key, price: currentPrice, timestamp: checkedAt });
  } catch {
    // Non-fatal: history is best-effort.
  }

  let triggered = false;
  let reason: AlertEvaluation['reason'];
  if (currentPrice <= alert.maxPrice) {
    triggered = true;
    reason = 'below_threshold';
  } else if (previousPrice != null && currentPrice < previousPrice) {
    triggered = true;
    reason = 'new_low';
  }

  // Update the alert's observed state.
  try {
    const nextLow = previousPrice == null ? currentPrice : Math.min(previousPrice, currentPrice);
    await supabase
      .from(ALERTS_TABLE)
      .update({
        last_price: nextLow,
        last_checked_at: checkedAt,
        last_triggered_at: triggered ? checkedAt : alert.lastTriggeredAt ?? null,
      })
      .eq('id', alert.id);
  } catch {
    // Non-fatal.
  }

  return {
    alert,
    currentPrice,
    previousPrice,
    triggered,
    reason,
    bestItinerary: found.itinerary,
  };
}

/** Evaluate every active alert for a user (used by the in-app "Check now"). */
export async function evaluateActiveAlerts(userId: string): Promise<AlertEvaluation[]> {
  const alerts = (await listAlerts(userId)).filter((a) => a.isActive);
  return Promise.all(alerts.map((a) => evaluateAlert(a)));
}

// ─── Preferences ────────────────────────────────────────────────────────

const DEFAULT_PREFS: UserFlightPreferences = {
  homeAirports: [],
  preferredAirlines: [],
  defaultCabin: 'economy',
  emailAlerts: true,
  pushAlerts: true,
};

export async function getPreferences(userId: string): Promise<UserFlightPreferences> {
  const { data, error } = await supabase
    .from(PREFS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_PREFS };
  return {
    homeAirports: data.home_airports ?? [],
    preferredAirlines: data.preferred_airlines ?? [],
    defaultCabin: data.default_cabin ?? 'economy',
    maxPrice: data.max_price ?? undefined,
    emailAlerts: data.email_alerts ?? true,
    pushAlerts: data.push_alerts ?? true,
  };
}

export async function savePreferences(
  userId: string,
  prefs: UserFlightPreferences,
): Promise<void> {
  const { error } = await supabase.from(PREFS_TABLE).upsert(
    {
      user_id: userId,
      home_airports: prefs.homeAirports,
      preferred_airlines: prefs.preferredAirlines,
      default_cabin: prefs.defaultCabin,
      max_price: prefs.maxPrice ?? null,
      email_alerts: prefs.emailAlerts,
      push_alerts: prefs.pushAlerts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
