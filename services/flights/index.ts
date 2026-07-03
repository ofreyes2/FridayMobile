/**
 * Flight module public API.
 *
 * Import everything flight-related from `@/services/flights`.
 */

export * from './types';
export * from './airports';
export {
  AIRLINES,
  baselinePrice,
  scoreDeal,
  getFlightProvider,
  setFlightProvider,
  MockFlightProvider,
  listAirportsForRegion,
} from './provider';
export type { FlightProvider, ProviderQuery } from './provider';
export {
  searchFlights,
  cheapestAnywhere,
  buildConnection,
  southwestOptimizer,
  clearFlightCache,
} from './flightService';
export {
  listAlerts,
  createAlert,
  updateAlert,
  toggleAlert,
  deleteAlert,
  describeAlert,
  evaluateAlert,
  evaluateActiveAlerts,
  recordPrice,
  getPriceHistory,
  routeKey,
  getPreferences,
  savePreferences,
} from './alertsService';

// ─── Formatting helpers shared by the UI ────────────────────────────────

export function formatPrice(usd: number, currency = 'USD'): string {
  if (!isFinite(usd)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(usd);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function stopsLabel(stops: number): string {
  if (stops === 0) return 'Nonstop';
  return stops === 1 ? '1 stop' : `${stops} stops`;
}
