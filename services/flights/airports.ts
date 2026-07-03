/**
 * Airport reference data.
 *
 * A curated set of major North American airports (plus a few international
 * gateways) with geo coordinates for map plotting and distance-based pricing.
 * Metro grouping lets "Chicago area" expand to ORD + MDW, etc.
 */

import type { Airport } from './types';

export const AIRPORTS: Airport[] = [
  // Chicago
  { code: 'ORD', name: "O'Hare International", city: 'Chicago', metro: 'Chicago', region: 'Midwest', country: 'US', lat: 41.9742, lng: -87.9073 },
  { code: 'MDW', name: 'Midway International', city: 'Chicago', metro: 'Chicago', region: 'Midwest', country: 'US', lat: 41.7868, lng: -87.7522 },
  // New York
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', metro: 'New York', region: 'Northeast', country: 'US', lat: 40.6413, lng: -73.7781 },
  { code: 'LGA', name: 'LaGuardia', city: 'New York', metro: 'New York', region: 'Northeast', country: 'US', lat: 40.7769, lng: -73.874 },
  { code: 'EWR', name: 'Newark Liberty International', city: 'Newark', metro: 'New York', region: 'Northeast', country: 'US', lat: 40.6895, lng: -74.1745 },
  // California
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', metro: 'Los Angeles', region: 'West', country: 'US', lat: 33.9416, lng: -118.4085 },
  { code: 'BUR', name: 'Hollywood Burbank', city: 'Burbank', metro: 'Los Angeles', region: 'West', country: 'US', lat: 34.2007, lng: -118.3587 },
  { code: 'SAN', name: 'San Diego International', city: 'San Diego', metro: 'San Diego', region: 'West', country: 'US', lat: 32.7338, lng: -117.1933 },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', metro: 'San Francisco', region: 'West', country: 'US', lat: 37.6213, lng: -122.379 },
  { code: 'OAK', name: 'Oakland International', city: 'Oakland', metro: 'San Francisco', region: 'West', country: 'US', lat: 37.7126, lng: -122.2197 },
  { code: 'SJC', name: 'San Jose International', city: 'San Jose', metro: 'San Francisco', region: 'West', country: 'US', lat: 37.3639, lng: -121.9289 },
  { code: 'SMF', name: 'Sacramento International', city: 'Sacramento', metro: 'Sacramento', region: 'West', country: 'US', lat: 38.6954, lng: -121.5907 },
  // Southwest / Mountain
  { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', metro: 'Las Vegas', region: 'West', country: 'US', lat: 36.084, lng: -115.1537 },
  { code: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', metro: 'Phoenix', region: 'West', country: 'US', lat: 33.4342, lng: -112.0116 },
  { code: 'DEN', name: 'Denver International', city: 'Denver', metro: 'Denver', region: 'West', country: 'US', lat: 39.8561, lng: -104.6737 },
  { code: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City', metro: 'Salt Lake City', region: 'West', country: 'US', lat: 40.7899, lng: -111.9791 },
  { code: 'ABQ', name: 'Albuquerque International Sunport', city: 'Albuquerque', metro: 'Albuquerque', region: 'West', country: 'US', lat: 35.0402, lng: -106.6091 },
  // Texas
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', metro: 'Dallas', region: 'South', country: 'US', lat: 32.8471, lng: -96.8518 },
  { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', metro: 'Dallas', region: 'South', country: 'US', lat: 32.8998, lng: -97.0403 },
  { code: 'HOU', name: 'William P. Hobby', city: 'Houston', metro: 'Houston', region: 'South', country: 'US', lat: 29.6454, lng: -95.2789 },
  { code: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', metro: 'Houston', region: 'South', country: 'US', lat: 29.9902, lng: -95.3368 },
  { code: 'AUS', name: 'Austin-Bergstrom International', city: 'Austin', metro: 'Austin', region: 'South', country: 'US', lat: 30.1975, lng: -97.6664 },
  { code: 'SAT', name: 'San Antonio International', city: 'San Antonio', metro: 'San Antonio', region: 'South', country: 'US', lat: 29.5337, lng: -98.4698 },
  // Southeast
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', metro: 'Atlanta', region: 'South', country: 'US', lat: 33.6407, lng: -84.4277 },
  { code: 'MCO', name: 'Orlando International', city: 'Orlando', metro: 'Orlando', region: 'South', country: 'US', lat: 28.4312, lng: -81.3081 },
  { code: 'MIA', name: 'Miami International', city: 'Miami', metro: 'Miami', region: 'South', country: 'US', lat: 25.7959, lng: -80.287 },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International', city: 'Fort Lauderdale', metro: 'Miami', region: 'South', country: 'US', lat: 26.0742, lng: -80.1506 },
  { code: 'TPA', name: 'Tampa International', city: 'Tampa', metro: 'Tampa', region: 'South', country: 'US', lat: 27.9755, lng: -82.5332 },
  { code: 'BNA', name: 'Nashville International', city: 'Nashville', metro: 'Nashville', region: 'South', country: 'US', lat: 36.1263, lng: -86.6774 },
  { code: 'CLT', name: 'Charlotte Douglas International', city: 'Charlotte', metro: 'Charlotte', region: 'South', country: 'US', lat: 35.214, lng: -80.9431 },
  // Midwest
  { code: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', metro: 'Minneapolis', region: 'Midwest', country: 'US', lat: 44.8848, lng: -93.2223 },
  { code: 'DTW', name: 'Detroit Metropolitan', city: 'Detroit', metro: 'Detroit', region: 'Midwest', country: 'US', lat: 42.2162, lng: -83.3554 },
  { code: 'STL', name: 'St. Louis Lambert International', city: 'St. Louis', metro: 'St. Louis', region: 'Midwest', country: 'US', lat: 38.7487, lng: -90.37 },
  { code: 'MCI', name: 'Kansas City International', city: 'Kansas City', metro: 'Kansas City', region: 'Midwest', country: 'US', lat: 39.2976, lng: -94.7139 },
  { code: 'CMH', name: 'John Glenn Columbus International', city: 'Columbus', metro: 'Columbus', region: 'Midwest', country: 'US', lat: 39.998, lng: -82.8919 },
  { code: 'IND', name: 'Indianapolis International', city: 'Indianapolis', metro: 'Indianapolis', region: 'Midwest', country: 'US', lat: 39.7173, lng: -86.2944 },
  // Northeast / Mid-Atlantic
  { code: 'BOS', name: 'Boston Logan International', city: 'Boston', metro: 'Boston', region: 'Northeast', country: 'US', lat: 42.3656, lng: -71.0096 },
  { code: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington', metro: 'Washington', region: 'Northeast', country: 'US', lat: 38.8512, lng: -77.0402 },
  { code: 'IAD', name: 'Washington Dulles International', city: 'Washington', metro: 'Washington', region: 'Northeast', country: 'US', lat: 38.9531, lng: -77.4565 },
  { code: 'BWI', name: 'Baltimore/Washington International', city: 'Baltimore', metro: 'Washington', region: 'Northeast', country: 'US', lat: 39.1774, lng: -76.6684 },
  { code: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', metro: 'Philadelphia', region: 'Northeast', country: 'US', lat: 39.8744, lng: -75.2424 },
  { code: 'PIT', name: 'Pittsburgh International', city: 'Pittsburgh', metro: 'Pittsburgh', region: 'Northeast', country: 'US', lat: 40.4915, lng: -80.2329 },
  // Pacific Northwest
  { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', metro: 'Seattle', region: 'West', country: 'US', lat: 47.4502, lng: -122.3088 },
  { code: 'PDX', name: 'Portland International', city: 'Portland', metro: 'Portland', region: 'West', country: 'US', lat: 45.5898, lng: -122.5951 },
  // Other gateways
  { code: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', metro: 'Honolulu', region: 'Pacific', country: 'US', lat: 21.3187, lng: -157.9225 },
  { code: 'ANC', name: 'Ted Stevens Anchorage International', city: 'Anchorage', metro: 'Anchorage', region: 'Pacific', country: 'US', lat: 61.1743, lng: -149.9962 },
];

const BY_CODE: Record<string, Airport> = Object.fromEntries(
  AIRPORTS.map((a) => [a.code, a]),
);

export const REGIONS: string[] = Array.from(new Set(AIRPORTS.map((a) => a.region))).sort();

export function getAirport(code: string): Airport | undefined {
  return BY_CODE[code.toUpperCase()];
}

export function airportLabel(code: string): string {
  const a = getAirport(code);
  return a ? `${a.city} (${a.code})` : code;
}

/**
 * Expand a list of origin/destination tokens into concrete airport codes.
 * Tokens may be an airport code (ORD), a metro name ("Chicago") or empty.
 * An empty input means "anywhere" and returns every airport.
 */
export function expandCodes(tokens: string[]): string[] {
  if (!tokens || tokens.length === 0) return AIRPORTS.map((a) => a.code);
  const out = new Set<string>();
  for (const raw of tokens) {
    const token = raw.trim();
    if (!token) continue;
    const upper = token.toUpperCase();
    if (BY_CODE[upper]) {
      out.add(upper);
      continue;
    }
    // metro or city match
    const metroMatches = AIRPORTS.filter(
      (a) => a.metro.toLowerCase() === token.toLowerCase() ||
        a.city.toLowerCase() === token.toLowerCase(),
    );
    metroMatches.forEach((a) => out.add(a.code));
  }
  return Array.from(out);
}

/** Case-insensitive search over code / city / name for pickers. */
export function searchAirports(query: string, limit = 12): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.slice(0, limit);
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.metro.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q),
  ).slice(0, limit);
}

const R_MILES = 3958.8;

/** Great-circle distance in miles between two airports. */
export function distanceMiles(a: string, b: string): number {
  const pa = getAirport(a);
  const pb = getAirport(b);
  if (!pa || !pb) return 0;
  const dLat = toRad(pb.lat - pa.lat);
  const dLng = toRad(pb.lng - pa.lng);
  const lat1 = toRad(pa.lat);
  const lat2 = toRad(pb.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
