/**
 * Flight data provider layer.
 *
 * The rest of the app talks to a `FlightProvider` interface, never to a
 * concrete API. This makes it trivial to swap the deterministic mock used in
 * development for a real GDS / OTA / meta-search integration (Amadeus,
 * Duffel, Kiwi/Tequila, Skyscanner) — implement the same interface and set it
 * via `setFlightProvider`.
 *
 * The mock is deterministic: prices are seeded from the route and date, so the
 * same query returns the same numbers, and price history / alerts behave
 * sensibly. A per-day "market noise" factor makes prices drift day to day.
 */

import type {
  Airport,
  CabinClass,
  FlightResult,
  Segment,
} from './types';
import { AIRPORTS, distanceMiles, getAirport } from './airports';

export interface ProviderQuery {
  origin: string; // single airport code
  destination: string; // single airport code
  departDate: string; // YYYY-MM-DD
  cabin: CabinClass;
  /** When set, only itineraries operated solely by these airlines are returned. */
  airlines?: string[];
}

export interface FlightProvider {
  readonly name: string;
  /** Returns a set of candidate itineraries for a single O&D pair on a date. */
  searchLeg(query: ProviderQuery): Promise<FlightResult[]>;
}

// ─── Airline catalogue ──────────────────────────────────────────────────

interface AirlineInfo {
  code: string;
  name: string;
  /** Price multiplier relative to the market baseline. */
  priceFactor: number;
  /** Rapid-rewards-style points per dollar (Southwest handled specially). */
  pointsPerDollar: number;
  lowCost: boolean;
}

export const AIRLINES: Record<string, AirlineInfo> = {
  WN: { code: 'WN', name: 'Southwest', priceFactor: 0.92, pointsPerDollar: 6, lowCost: true },
  AA: { code: 'AA', name: 'American', priceFactor: 1.0, pointsPerDollar: 5, lowCost: false },
  UA: { code: 'UA', name: 'United', priceFactor: 1.02, pointsPerDollar: 5, lowCost: false },
  DL: { code: 'DL', name: 'Delta', priceFactor: 1.05, pointsPerDollar: 5, lowCost: false },
  B6: { code: 'B6', name: 'JetBlue', priceFactor: 0.95, pointsPerDollar: 3, lowCost: false },
  AS: { code: 'AS', name: 'Alaska', priceFactor: 0.98, pointsPerDollar: 3, lowCost: false },
  NK: { code: 'NK', name: 'Spirit', priceFactor: 0.72, pointsPerDollar: 2, lowCost: true },
  F9: { code: 'F9', name: 'Frontier', priceFactor: 0.74, pointsPerDollar: 2, lowCost: true },
};

const CABIN_MULTIPLIER: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.6,
  business: 2.9,
  first: 4.2,
};

// ─── Deterministic pseudo-randomness ────────────────────────────────────

/** Stable 32-bit hash of a string. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic float in [0,1) from a seed string. */
function seededUnit(seed: string): number {
  const h = hashStr(seed);
  return (h % 100000) / 100000;
}

function dayOfYear(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const start = Date.UTC(y, 0, 0);
  const cur = Date.UTC(y, (m || 1) - 1, d || 1);
  return Math.floor((cur - start) / 86400000);
}

/** Base one-way economy price for a nonstop between two airports on a date. */
export function baselinePrice(origin: string, destination: string, dateIso: string): number {
  const miles = distanceMiles(origin, destination);
  // Fare = fixed cost + per-mile taper (longer trips are cheaper per mile).
  const base = 48 + Math.pow(miles, 0.82) * 0.34;
  // Day-of-week + seasonality: weekends and mid-summer cost more.
  const doy = dayOfYear(dateIso);
  const weekday = doy % 7;
  const weekendBump = weekday === 5 || weekday === 6 || weekday === 0 ? 1.14 : 1.0;
  const season = 1 + 0.12 * Math.sin((doy / 365) * Math.PI * 2 - 1.2);
  // Stable per-route market noise + slow day-to-day drift.
  const routeNoise = 0.85 + seededUnit(`${origin}${destination}`) * 0.4;
  const drift = 0.94 + seededUnit(`${origin}${destination}${dateIso}`) * 0.16;
  return Math.round(base * weekendBump * season * routeNoise * drift);
}

/** Deal score 0-100 comparing a price to the route's typical baseline. */
export function scoreDeal(
  price: number,
  origin: string,
  destination: string,
  dateIso: string,
): { dealScore: number; dealLabel: FlightResult['dealLabel'] } {
  const typical = baselinePrice(origin, destination, dateIso);
  const ratio = price / Math.max(1, typical);
  // ratio 0.7 -> ~95, 1.0 -> ~55, 1.3 -> ~15
  const score = Math.max(0, Math.min(100, Math.round(120 - ratio * 65)));
  let label: FlightResult['dealLabel'] = 'typical';
  if (ratio <= 0.82) label = 'great';
  else if (ratio <= 0.95) label = 'good';
  else if (ratio >= 1.15) label = 'high';
  return { dealScore: score, dealLabel: label };
}

function addMinutesIso(dateIso: string, minutesFromMidnight: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const base = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0);
  return new Date(base + minutesFromMidnight * 60000).toISOString();
}

function pointsFor(airline: string, price: number): Record<string, number> {
  const info = AIRLINES[airline];
  if (!info) return {};
  return { [airline]: Math.round(price * info.pointsPerDollar) };
}

/**
 * The built-in deterministic mock provider. Generates a realistic spread of
 * nonstop and connecting itineraries across several airlines for a leg.
 */
export class MockFlightProvider implements FlightProvider {
  readonly name = 'mock';

  async searchLeg(query: ProviderQuery): Promise<FlightResult[]> {
    const { origin, destination, departDate, cabin } = query;
    if (origin === destination) return [];
    if (!getAirport(origin) || !getAirport(destination)) return [];

    const allowed = query.airlines && query.airlines.length > 0 ? new Set(query.airlines) : null;
    const results: FlightResult[] = [];
    const miles = distanceMiles(origin, destination);
    const nonstopMinutes = Math.round(45 + miles / 7.8);

    // Which airlines serve this route (deterministic subset of 3-6 carriers).
    const carriers = Object.keys(AIRLINES).filter((code) => {
      if (allowed && !allowed.has(code)) return false;
      const serves = seededUnit(`${code}-${origin}-${destination}`);
      // Low-cost carriers serve fewer routes; legacies serve most.
      const threshold = AIRLINES[code].lowCost ? 0.55 : 0.2;
      return serves > threshold;
    });
    // Guarantee at least one carrier so results are never empty for valid O&D.
    if (carriers.length === 0 && !allowed) carriers.push('AA');

    for (const code of carriers) {
      const info = AIRLINES[code];
      const cabinMult = CABIN_MULTIPLIER[cabin];

      // Nonstop option
      const nsPrice = Math.round(
        baselinePrice(origin, destination, departDate) * info.priceFactor * cabinMult,
      );
      const departMin = 360 + Math.floor(seededUnit(`${code}${origin}${destination}dep`) * 720);
      results.push(
        buildResult({
          origin,
          destination,
          departDate,
          cabin,
          price: nsPrice,
          segments: [
            makeSegment(code, info.name, origin, destination, departDate, departMin, nonstopMinutes),
          ],
        }),
      );

      // One-stop option via a plausible hub (cheaper, longer) for non-LCC.
      if (!info.lowCost || seededUnit(`${code}stop`) > 0.5) {
        const hub = pickHub(origin, destination, code);
        if (hub && hub !== origin && hub !== destination) {
          const leg1 = Math.round(45 + distanceMiles(origin, hub) / 7.8);
          const leg2 = Math.round(45 + distanceMiles(hub, destination) / 7.8);
          const layover = 55 + Math.floor(seededUnit(`${code}${hub}lay`) * 90);
          const stopPrice = Math.round(nsPrice * (0.78 + seededUnit(`${code}${hub}p`) * 0.12));
          const dep2 = departMin;
          results.push(
            buildResult({
              origin,
              destination,
              departDate,
              cabin,
              price: stopPrice,
              segments: [
                makeSegment(code, info.name, origin, hub, departDate, dep2, leg1),
                makeSegment(code, info.name, hub, destination, departDate, dep2 + leg1 + layover, leg2),
              ],
            }),
          );
        }
      }
    }

    return results;
  }
}

function makeSegment(
  airline: string,
  airlineName: string,
  origin: string,
  destination: string,
  departDate: string,
  departMin: number,
  durationMinutes: number,
): Segment {
  const flightNumber = `${airline}${100 + (hashStr(`${airline}${origin}${destination}`) % 1899)}`;
  return {
    origin,
    destination,
    airline,
    airlineName,
    flightNumber,
    departTime: addMinutesIso(departDate, departMin),
    arriveTime: addMinutesIso(departDate, departMin + durationMinutes),
    durationMinutes,
  };
}

function buildResult(args: {
  origin: string;
  destination: string;
  departDate: string;
  cabin: CabinClass;
  price: number;
  segments: Segment[];
}): FlightResult {
  const { origin, destination, departDate, cabin, price, segments } = args;
  const totalDuration = segments.reduce((s, seg) => s + seg.durationMinutes, 0) +
    // include layover gaps
    segments.slice(1).reduce((s, seg, i) => {
      const prev = segments[i];
      return s + Math.max(0, minutesBetween(prev.arriveTime, seg.departTime));
    }, 0);
  const airlines = Array.from(new Set(segments.map((s) => s.airline)));
  const { dealScore, dealLabel } = scoreDeal(price, origin, destination, departDate);
  const loyaltyPoints = airlines.reduce<Record<string, number>>((acc, a) => {
    return { ...acc, ...pointsFor(a, price) };
  }, {});
  return {
    itineraryId: `${origin}-${destination}-${departDate}-${airlines.join('')}-${segments.length}-${price}`,
    segments,
    airlines,
    totalPrice: price,
    currency: 'USD',
    durationMinutes: totalDuration,
    stops: segments.length - 1,
    cabin,
    fareClass: cabin === 'economy' ? 'Y' : cabin === 'business' ? 'J' : 'W',
    loyaltyPoints,
    dealScore,
    dealLabel,
  };
}

function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 60000);
}

/** Pick a connecting hub roughly between origin and destination. */
function pickHub(origin: string, destination: string, seed: string): string | null {
  const hubsByAirline: Record<string, string[]> = {
    AA: ['DFW', 'CLT', 'PHX', 'ORD'],
    UA: ['ORD', 'DEN', 'IAH', 'EWR', 'SFO'],
    DL: ['ATL', 'DTW', 'MSP', 'SLC'],
    WN: ['MDW', 'DEN', 'LAS', 'BWI', 'PHX'],
    B6: ['JFK', 'BOS', 'FLL'],
    AS: ['SEA', 'SFO', 'LAX'],
    NK: ['FLL', 'DFW', 'LAS'],
    F9: ['DEN', 'MCO'],
  };
  const candidates = (hubsByAirline[seed] || ['DEN', 'DFW', 'ATL']).filter(
    (h) => h !== origin && h !== destination,
  );
  if (candidates.length === 0) return null;
  const idx = hashStr(`${origin}${destination}${seed}`) % candidates.length;
  return candidates[idx];
}

// ─── Provider registry ──────────────────────────────────────────────────

let activeProvider: FlightProvider = new MockFlightProvider();

export function getFlightProvider(): FlightProvider {
  return activeProvider;
}

export function setFlightProvider(provider: FlightProvider): void {
  activeProvider = provider;
}

export function listAirportsForRegion(region?: string): Airport[] {
  if (!region) return AIRPORTS;
  return AIRPORTS.filter((a) => a.region === region);
}
