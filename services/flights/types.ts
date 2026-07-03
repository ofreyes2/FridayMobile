/**
 * Flight domain types
 * Shared across the flight search, cheapest-anywhere, connection builder,
 * Southwest optimizer and alerts features.
 */

export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type StopFilter = 'any' | 'nonstop' | 'one_stop' | 'multi_stop';

export interface Airport {
  code: string; // IATA, e.g. "ORD"
  name: string;
  city: string;
  metro: string; // metro grouping, e.g. "Chicago" (ORD + MDW)
  region: string; // e.g. "Midwest", "West", "Northeast"
  country: string;
  lat: number;
  lng: number;
}

export interface Passengers {
  adults: number;
  children: number;
}

export interface SearchFilters {
  airlines?: string[]; // airline codes to include; empty/undefined = all
  cabin?: CabinClass;
  stops?: StopFilter;
  maxPrice?: number; // per traveler, USD
  southwestOnly?: boolean;
}

/** A single flown leg within an itinerary. */
export interface Segment {
  origin: string; // airport code
  destination: string; // airport code
  airline: string; // airline code
  airlineName: string;
  flightNumber: string;
  departTime: string; // ISO
  arriveTime: string; // ISO
  durationMinutes: number;
}

/** A complete priced itinerary (one direction). */
export interface FlightResult {
  itineraryId: string;
  segments: Segment[];
  airlines: string[]; // distinct airline codes across segments
  totalPrice: number; // per traveler, USD
  currency: string;
  durationMinutes: number;
  stops: number;
  cabin: CabinClass;
  fareClass: string;
  /** Loyalty points earned, keyed by airline code. Southwest is special-cased. */
  loyaltyPoints: Record<string, number>;
  /** 0-100 deal score: higher = better relative to typical prices for this route. */
  dealScore: number;
  dealLabel: 'great' | 'good' | 'typical' | 'high';
}

export interface FlightSearchRequest {
  origins: string[]; // one or more airport/metro codes, [] = anywhere
  destinations: string[]; // one or more, [] = anywhere
  departDate: string; // ISO date (YYYY-MM-DD)
  returnDate?: string; // optional round-trip
  flexDays?: number; // +/- days to scan around departDate
  passengers: Passengers;
  filters?: SearchFilters;
}

export interface SearchMeta {
  cheapest?: string; // itineraryId
  fastest?: string; // itineraryId
  bestValue?: string; // itineraryId
  count: number;
  searchedAt: string; // ISO
  fromCache: boolean;
}

export interface SearchResponse {
  results: FlightResult[];
  meta: SearchMeta;
}

/** One destination row for the cheapest-anywhere explorer / map. */
export interface CheapestDestination {
  destination: Airport;
  fromOrigin: string; // origin code the price is measured from
  price: number; // cheapest per-traveler price found
  stops: number;
  durationMinutes: number;
  airline: string;
  dealScore: number;
  itineraryId: string;
}

export interface CheapestAnywhereRequest {
  origins: string[];
  departDate: string;
  returnDate?: string;
  passengers: Passengers;
  filters?: SearchFilters;
  region?: string; // limit destinations to a region
  maxPrice?: number;
  limit?: number;
}

/** A user-built multi-city connection itinerary. */
export interface ConnectionPlan {
  stops: string[]; // ordered airport codes, e.g. [ORD, DEN, LAS, PHX, ORD]
  legs: FlightResult[]; // one FlightResult per hop
  totalPrice: number;
  totalDurationMinutes: number;
  totalStops: number;
  /** Cost of the equivalent direct/return trip for comparison. */
  directPrice: number;
  savings: number;
}

// ─── Southwest optimizer ────────────────────────────────────────────────

export interface SouthwestFlight {
  itineraryId: string;
  origin: string;
  destination: string;
  departDate: string;
  price: number;
  durationMinutes: number;
  /** Tier-qualifying Rapid Rewards points. */
  tierPoints: number;
  /** Redeemable Rapid Rewards points earned. */
  rewardPoints: number;
  /** Points earned per dollar spent. */
  pointsPerDollar: number;
  /** Companion Pass qualifying points (same as tier points for revenue fares). */
  companionPoints: number;
}

export interface SouthwestOptimizerRequest {
  origins: string[];
  departDate: string;
  dateRangeDays?: number; // scan this many days forward
  maxHopMinutes?: number; // only short hops (default 150 = 2.5h)
  passengers?: Passengers;
}

export interface SouthwestOptimizerResponse {
  flights: SouthwestFlight[];
  /** Companion Pass requires 135,000 qualifying points in a calendar year. */
  companionPassTarget: number;
  /** A-List tier target (35,000 tier points). */
  aListTarget: number;
  bestValueItineraryId?: string;
}

// ─── Alerts ─────────────────────────────────────────────────────────────

export type AlertKind = 'route' | 'cheapest_anywhere' | 'southwest';

export interface Alert {
  id: string;
  userId: string;
  kind: AlertKind;
  label: string; // human-readable summary
  origins: string[];
  destinations: string[]; // empty for cheapest_anywhere
  departDate: string;
  returnDate?: string;
  maxPrice: number;
  airlines: string[];
  cabin: CabinClass;
  southwestOnly: boolean;
  isActive: boolean;
  /** Cheapest price observed since the alert was created. */
  lastPrice?: number;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewAlert = Omit<
  Alert,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'lastPrice' | 'lastCheckedAt' | 'lastTriggeredAt'
>;

export interface PricePoint {
  routeKey: string; // origin>destination>date
  timestamp: string; // ISO
  price: number;
}

export interface AlertEvaluation {
  alert: Alert;
  currentPrice: number;
  previousPrice?: number;
  triggered: boolean;
  reason?: 'below_threshold' | 'new_low';
  bestItinerary?: FlightResult;
}

export interface UserFlightPreferences {
  homeAirports: string[];
  preferredAirlines: string[];
  defaultCabin: CabinClass;
  maxPrice?: number;
  emailAlerts: boolean;
  pushAlerts: boolean;
}
