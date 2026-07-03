/**
 * Flight search orchestration.
 *
 * Fans out over origins/destinations, calls the active provider per O&D leg,
 * applies filters, and shapes the responses used by the UI: point-to-point
 * search, cheapest-anywhere explorer, connection builder and the Southwest
 * short-jump optimizer. A small TTL cache in front of the provider keeps
 * popular queries fast and within provider rate limits.
 */

import {
  AIRPORTS,
  distanceMiles,
  expandCodes,
} from './airports';
import {
  AIRLINES,
  baselinePrice,
  getFlightProvider,
} from './provider';
import type {
  CheapestAnywhereRequest,
  CheapestDestination,
  ConnectionPlan,
  FlightResult,
  FlightSearchRequest,
  SearchFilters,
  SearchResponse,
  SouthwestFlight,
  SouthwestOptimizerRequest,
  SouthwestOptimizerResponse,
} from './types';

// ─── TTL cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  value: FlightResult[];
  expires: number;
}
const legCache = new Map<string, CacheEntry>();
const LEG_TTL_MS = 5 * 60 * 1000; // 5 minutes; tune to provider freshness/limits

function now(): number {
  // Date.now is available at runtime in the app; wrapped for testability.
  return Date.now();
}

async function searchLegCached(
  origin: string,
  destination: string,
  departDate: string,
  filters: SearchFilters,
): Promise<FlightResult[]> {
  const cabin = filters.cabin ?? 'economy';
  const airlines = filters.southwestOnly ? ['WN'] : filters.airlines ?? [];
  const key = `${origin}>${destination}>${departDate}>${cabin}>${airlines.join(',')}`;
  const hit = legCache.get(key);
  if (hit && hit.expires > now()) return hit.value;

  const value = await getFlightProvider().searchLeg({
    origin,
    destination,
    departDate,
    cabin,
    airlines: airlines.length ? airlines : undefined,
  });
  legCache.set(key, { value, expires: now() + LEG_TTL_MS });
  return value;
}

export function clearFlightCache(): void {
  legCache.clear();
}

// ─── Filtering ──────────────────────────────────────────────────────────

function applyFilters(results: FlightResult[], filters: SearchFilters): FlightResult[] {
  return results.filter((r) => {
    if (filters.maxPrice != null && r.totalPrice > filters.maxPrice) return false;
    if (filters.southwestOnly && !r.airlines.every((a) => a === 'WN')) return false;
    if (filters.airlines && filters.airlines.length > 0) {
      if (!r.airlines.every((a) => filters.airlines!.includes(a))) return false;
    }
    switch (filters.stops) {
      case 'nonstop':
        if (r.stops !== 0) return false;
        break;
      case 'one_stop':
        if (r.stops !== 1) return false;
        break;
      case 'multi_stop':
        if (r.stops < 2) return false;
        break;
    }
    return true;
  });
}

function datesToScan(departDate: string, flexDays = 0): string[] {
  if (!flexDays) return [departDate];
  const [y, m, d] = departDate.split('-').map(Number);
  const base = Date.UTC(y, (m || 1) - 1, d || 1);
  const out: string[] = [];
  for (let off = -flexDays; off <= flexDays; off++) {
    out.push(new Date(base + off * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

// ─── Point-to-point / anywhere search ──────────────────────────────────

export async function searchFlights(req: FlightSearchRequest): Promise<SearchResponse> {
  const filters = req.filters ?? {};
  const origins = expandCodes(req.origins);
  const destinations = expandCodes(req.destinations);
  const dates = datesToScan(req.departDate, req.flexDays);

  const legTasks: Promise<FlightResult[]>[] = [];
  for (const o of origins) {
    for (const d of destinations) {
      if (o === d) continue;
      for (const date of dates) {
        legTasks.push(searchLegCached(o, d, date, filters));
      }
    }
  }

  const legs = (await Promise.all(legTasks)).flat();
  const filtered = applyFilters(legs, filters);

  // De-dupe identical itineraries and sort by price.
  const seen = new Set<string>();
  const results = filtered
    .filter((r) => (seen.has(r.itineraryId) ? false : (seen.add(r.itineraryId), true)))
    .sort((a, b) => a.totalPrice - b.totalPrice);

  const cheapest = results[0];
  const fastest = [...results].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const bestValue = [...results].sort((a, b) => b.dealScore - a.dealScore)[0];

  return {
    results,
    meta: {
      cheapest: cheapest?.itineraryId,
      fastest: fastest?.itineraryId,
      bestValue: bestValue?.itineraryId,
      count: results.length,
      searchedAt: new Date().toISOString(),
      fromCache: false,
    },
  };
}

// ─── Cheapest-anywhere explorer ─────────────────────────────────────────

export async function cheapestAnywhere(
  req: CheapestAnywhereRequest,
): Promise<CheapestDestination[]> {
  const filters = req.filters ?? {};
  const origins = expandCodes(req.origins);
  const originSet = new Set(origins);

  const destPool = AIRPORTS.filter((a) => {
    if (originSet.has(a.code)) return false;
    if (req.region && a.region !== req.region) return false;
    return true;
  });

  const rows = await Promise.all(
    destPool.map(async (dest) => {
      // Cheapest across all requested origins for this destination.
      let best: CheapestDestination | null = null;
      for (const o of origins) {
        if (o === dest.code) continue;
        const legs = applyFilters(
          await searchLegCached(o, dest.code, req.departDate, filters),
          filters,
        );
        for (const leg of legs) {
          if (req.maxPrice != null && leg.totalPrice > req.maxPrice) continue;
          if (!best || leg.totalPrice < best.price) {
            best = {
              destination: dest,
              fromOrigin: o,
              price: leg.totalPrice,
              stops: leg.stops,
              durationMinutes: leg.durationMinutes,
              airline: leg.airlines[0],
              dealScore: leg.dealScore,
              itineraryId: leg.itineraryId,
            };
          }
        }
      }
      return best;
    }),
  );

  const out = rows.filter((r): r is CheapestDestination => r != null);
  out.sort((a, b) => a.price - b.price);
  return out.slice(0, req.limit ?? 40);
}

// ─── Connection builder ─────────────────────────────────────────────────

/**
 * Price a user-defined multi-city path (e.g. ORD → DEN → LAS → PHX → ORD),
 * choosing the cheapest itinerary for each hop, and compare it to the cost of
 * flying the origin↔final destination round trip directly.
 */
export async function buildConnection(
  stops: string[],
  departDate: string,
  filters: SearchFilters = {},
): Promise<ConnectionPlan> {
  const codes = stops.map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (codes.length < 2) {
    throw new Error('A connection needs at least two stops.');
  }

  const legs: FlightResult[] = [];
  for (let i = 0; i < codes.length - 1; i++) {
    const legOptions = applyFilters(
      await searchLegCached(codes[i], codes[i + 1], departDate, filters),
      filters,
    ).sort((a, b) => a.totalPrice - b.totalPrice);
    if (legOptions.length === 0) {
      throw new Error(`No flights found for ${codes[i]} → ${codes[i + 1]}.`);
    }
    legs.push(legOptions[0]);
  }

  const totalPrice = legs.reduce((s, l) => s + l.totalPrice, 0);
  const totalDurationMinutes = legs.reduce((s, l) => s + l.durationMinutes, 0);
  const totalStops = legs.reduce((s, l) => s + l.stops, 0) + (legs.length - 1);

  // Direct comparison: first hop to last hop, plus return if it's a loop.
  const first = codes[0];
  const last = codes[codes.length - 1];
  const isLoop = first === last;
  const midpoint = codes[Math.floor(codes.length / 2)];
  const directOneWay = baselinePrice(first, isLoop ? midpoint : last, departDate);
  const directPrice = Math.round(isLoop ? directOneWay * 2 : directOneWay);

  return {
    stops: codes,
    legs,
    totalPrice,
    totalDurationMinutes,
    totalStops,
    directPrice,
    savings: Math.max(0, directPrice - totalPrice),
  };
}

// ─── Southwest short-jump optimizer ─────────────────────────────────────

const COMPANION_PASS_TARGET = 135000; // qualifying points in a calendar year
const A_LIST_TARGET = 35000; // A-List tier-qualifying points

export async function southwestOptimizer(
  req: SouthwestOptimizerRequest,
): Promise<SouthwestOptimizerResponse> {
  const origins = expandCodes(req.origins);
  const maxHop = req.maxHopMinutes ?? 150;
  const rangeDays = req.dateRangeDays ?? 7;
  const dates = datesToScan(req.departDate, 0).length
    ? buildDateRange(req.departDate, rangeDays)
    : [req.departDate];

  const flights: SouthwestFlight[] = [];

  for (const o of origins) {
    // Only Southwest-served short-haul destinations.
    const shortHops = AIRPORTS.filter((a) => {
      if (a.code === o) return false;
      const est = 45 + distanceMiles(o, a.code) / 7.8;
      return est <= maxHop;
    });

    for (const dest of shortHops) {
      for (const date of dates) {
        const legs = await searchLegCached(o, dest.code, date, {
          southwestOnly: true,
          cabin: 'economy',
        });
        const nonstop = legs
          .filter((l) => l.stops === 0)
          .sort((a, b) => a.totalPrice - b.totalPrice)[0];
        if (!nonstop) continue;

        const info = AIRLINES.WN;
        const rewardPoints = Math.round(nonstop.totalPrice * info.pointsPerDollar);
        // Rapid Rewards tier & Companion Pass points ≈ 6 pts/$ on Anytime-style fares.
        const tierPoints = rewardPoints;
        flights.push({
          itineraryId: nonstop.itineraryId,
          origin: o,
          destination: dest.code,
          departDate: date,
          price: nonstop.totalPrice,
          durationMinutes: nonstop.durationMinutes,
          tierPoints,
          rewardPoints,
          pointsPerDollar: info.pointsPerDollar,
          companionPoints: tierPoints,
        });
      }
    }
  }

  // Rank by points per dollar, then by lowest price.
  flights.sort((a, b) => b.pointsPerDollar - a.pointsPerDollar || a.price - b.price);
  const bestValue = [...flights].sort(
    (a, b) => b.tierPoints / b.price - a.tierPoints / a.price,
  )[0];

  return {
    flights: flights.slice(0, 60),
    companionPassTarget: COMPANION_PASS_TARGET,
    aListTarget: A_LIST_TARGET,
    bestValueItineraryId: bestValue?.itineraryId,
  };
}

function buildDateRange(startIso: string, days: number): string[] {
  const [y, m, d] = startIso.split('-').map(Number);
  const base = Date.UTC(y, (m || 1) - 1, d || 1);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(new Date(base + i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}
