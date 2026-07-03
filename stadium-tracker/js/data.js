/**
 * Stadium reference data — MLB (American + National League) and NFL.
 *
 * One entry per physical stadium. NFL stadiums shared by two teams
 * (MetLife, SoFi) appear once with both teams listed, so "visited" counts
 * a stadium a single time. Coordinates are approximate (good enough for
 * distance estimates); tap a card's Directions button for exact routing.
 *
 * This module is pure data + helpers. Swapping in a live API later means
 * replacing this file (or fetching into the same shape) — nothing else.
 */

/** @typedef {'MLB'|'NFL'} League */

/**
 * @typedef {Object} Stadium
 * @property {string} id
 * @property {League} league
 * @property {string} division   e.g. "AL East" or "AFC West"
 * @property {string[]} teams
 * @property {string} name
 * @property {string} aka        alternate / former name, or ''
 * @property {string} city
 * @property {string} state
 * @property {number} lat
 * @property {number} lng
 */

/** @type {Stadium[]} */
export const STADIUMS = [
  // ─── MLB · American League ────────────────────────────────────────────
  { id: 'camden-yards', league: 'MLB', division: 'AL East', teams: ['Baltimore Orioles'], name: 'Oriole Park at Camden Yards', aka: '', city: 'Baltimore', state: 'MD', lat: 39.2839, lng: -76.6217 },
  { id: 'fenway-park', league: 'MLB', division: 'AL East', teams: ['Boston Red Sox'], name: 'Fenway Park', aka: '', city: 'Boston', state: 'MA', lat: 42.3467, lng: -71.0972 },
  { id: 'yankee-stadium', league: 'MLB', division: 'AL East', teams: ['New York Yankees'], name: 'Yankee Stadium', aka: '', city: 'Bronx', state: 'NY', lat: 40.8296, lng: -73.9262 },
  { id: 'tropicana-field', league: 'MLB', division: 'AL East', teams: ['Tampa Bay Rays'], name: 'Tropicana Field', aka: '', city: 'St. Petersburg', state: 'FL', lat: 27.7683, lng: -82.6534 },
  { id: 'rogers-centre', league: 'MLB', division: 'AL East', teams: ['Toronto Blue Jays'], name: 'Rogers Centre', aka: '', city: 'Toronto', state: 'ON', lat: 43.6414, lng: -79.3894 },

  { id: 'rate-field', league: 'MLB', division: 'AL Central', teams: ['Chicago White Sox'], name: 'Rate Field', aka: 'Guaranteed Rate Field', city: 'Chicago', state: 'IL', lat: 41.8299, lng: -87.6338 },
  { id: 'progressive-field', league: 'MLB', division: 'AL Central', teams: ['Cleveland Guardians'], name: 'Progressive Field', aka: '', city: 'Cleveland', state: 'OH', lat: 41.4962, lng: -81.6852 },
  { id: 'comerica-park', league: 'MLB', division: 'AL Central', teams: ['Detroit Tigers'], name: 'Comerica Park', aka: '', city: 'Detroit', state: 'MI', lat: 42.3390, lng: -83.0485 },
  { id: 'kauffman-stadium', league: 'MLB', division: 'AL Central', teams: ['Kansas City Royals'], name: 'Kauffman Stadium', aka: '', city: 'Kansas City', state: 'MO', lat: 39.0517, lng: -94.4803 },
  { id: 'target-field', league: 'MLB', division: 'AL Central', teams: ['Minnesota Twins'], name: 'Target Field', aka: '', city: 'Minneapolis', state: 'MN', lat: 44.9817, lng: -93.2776 },

  { id: 'daikin-park', league: 'MLB', division: 'AL West', teams: ['Houston Astros'], name: 'Daikin Park', aka: 'Minute Maid Park', city: 'Houston', state: 'TX', lat: 29.7573, lng: -95.3555 },
  { id: 'angel-stadium', league: 'MLB', division: 'AL West', teams: ['Los Angeles Angels'], name: 'Angel Stadium', aka: '', city: 'Anaheim', state: 'CA', lat: 33.8003, lng: -117.8827 },
  { id: 'sutter-health-park', league: 'MLB', division: 'AL West', teams: ['Athletics'], name: 'Sutter Health Park', aka: 'Temporary home of the Athletics', city: 'West Sacramento', state: 'CA', lat: 38.5802, lng: -121.5135 },
  { id: 't-mobile-park', league: 'MLB', division: 'AL West', teams: ['Seattle Mariners'], name: 'T-Mobile Park', aka: '', city: 'Seattle', state: 'WA', lat: 47.5914, lng: -122.3325 },
  { id: 'globe-life-field', league: 'MLB', division: 'AL West', teams: ['Texas Rangers'], name: 'Globe Life Field', aka: '', city: 'Arlington', state: 'TX', lat: 32.7473, lng: -97.0847 },

  // ─── MLB · National League ────────────────────────────────────────────
  { id: 'truist-park', league: 'MLB', division: 'NL East', teams: ['Atlanta Braves'], name: 'Truist Park', aka: '', city: 'Atlanta', state: 'GA', lat: 33.8908, lng: -84.4678 },
  { id: 'loandepot-park', league: 'MLB', division: 'NL East', teams: ['Miami Marlins'], name: 'loanDepot park', aka: '', city: 'Miami', state: 'FL', lat: 25.7781, lng: -80.2197 },
  { id: 'citi-field', league: 'MLB', division: 'NL East', teams: ['New York Mets'], name: 'Citi Field', aka: '', city: 'Queens', state: 'NY', lat: 40.7571, lng: -73.8458 },
  { id: 'citizens-bank-park', league: 'MLB', division: 'NL East', teams: ['Philadelphia Phillies'], name: 'Citizens Bank Park', aka: '', city: 'Philadelphia', state: 'PA', lat: 39.9061, lng: -75.1665 },
  { id: 'nationals-park', league: 'MLB', division: 'NL East', teams: ['Washington Nationals'], name: 'Nationals Park', aka: '', city: 'Washington', state: 'DC', lat: 38.8730, lng: -77.0074 },

  { id: 'wrigley-field', league: 'MLB', division: 'NL Central', teams: ['Chicago Cubs'], name: 'Wrigley Field', aka: '', city: 'Chicago', state: 'IL', lat: 41.9484, lng: -87.6553 },
  { id: 'great-american-ball-park', league: 'MLB', division: 'NL Central', teams: ['Cincinnati Reds'], name: 'Great American Ball Park', aka: '', city: 'Cincinnati', state: 'OH', lat: 39.0975, lng: -84.5069 },
  { id: 'american-family-field', league: 'MLB', division: 'NL Central', teams: ['Milwaukee Brewers'], name: 'American Family Field', aka: '', city: 'Milwaukee', state: 'WI', lat: 43.0280, lng: -87.9712 },
  { id: 'pnc-park', league: 'MLB', division: 'NL Central', teams: ['Pittsburgh Pirates'], name: 'PNC Park', aka: '', city: 'Pittsburgh', state: 'PA', lat: 40.4469, lng: -80.0057 },
  { id: 'busch-stadium', league: 'MLB', division: 'NL Central', teams: ['St. Louis Cardinals'], name: 'Busch Stadium', aka: '', city: 'St. Louis', state: 'MO', lat: 38.6226, lng: -90.1928 },

  { id: 'chase-field', league: 'MLB', division: 'NL West', teams: ['Arizona Diamondbacks'], name: 'Chase Field', aka: '', city: 'Phoenix', state: 'AZ', lat: 33.4455, lng: -112.0667 },
  { id: 'coors-field', league: 'MLB', division: 'NL West', teams: ['Colorado Rockies'], name: 'Coors Field', aka: '', city: 'Denver', state: 'CO', lat: 39.7559, lng: -104.9942 },
  { id: 'dodger-stadium', league: 'MLB', division: 'NL West', teams: ['Los Angeles Dodgers'], name: 'Dodger Stadium', aka: '', city: 'Los Angeles', state: 'CA', lat: 34.0739, lng: -118.2400 },
  { id: 'petco-park', league: 'MLB', division: 'NL West', teams: ['San Diego Padres'], name: 'Petco Park', aka: '', city: 'San Diego', state: 'CA', lat: 32.7073, lng: -117.1566 },
  { id: 'oracle-park', league: 'MLB', division: 'NL West', teams: ['San Francisco Giants'], name: 'Oracle Park', aka: '', city: 'San Francisco', state: 'CA', lat: 37.7786, lng: -122.3893 },

  // ─── NFL · AFC ────────────────────────────────────────────────────────
  { id: 'highmark-stadium', league: 'NFL', division: 'AFC East', teams: ['Buffalo Bills'], name: 'Highmark Stadium', aka: '', city: 'Orchard Park', state: 'NY', lat: 42.7738, lng: -78.7870 },
  { id: 'hard-rock-stadium', league: 'NFL', division: 'AFC East', teams: ['Miami Dolphins'], name: 'Hard Rock Stadium', aka: '', city: 'Miami Gardens', state: 'FL', lat: 25.9580, lng: -80.2389 },
  { id: 'gillette-stadium', league: 'NFL', division: 'AFC East', teams: ['New England Patriots'], name: 'Gillette Stadium', aka: '', city: 'Foxborough', state: 'MA', lat: 42.0909, lng: -71.2643 },
  { id: 'metlife-stadium', league: 'NFL', division: 'AFC East / NFC East', teams: ['New York Jets', 'New York Giants'], name: 'MetLife Stadium', aka: 'Shared by Jets & Giants', city: 'East Rutherford', state: 'NJ', lat: 40.8135, lng: -74.0745 },

  { id: 'mt-bank-stadium', league: 'NFL', division: 'AFC North', teams: ['Baltimore Ravens'], name: 'M&T Bank Stadium', aka: '', city: 'Baltimore', state: 'MD', lat: 39.2780, lng: -76.6227 },
  { id: 'paycor-stadium', league: 'NFL', division: 'AFC North', teams: ['Cincinnati Bengals'], name: 'Paycor Stadium', aka: '', city: 'Cincinnati', state: 'OH', lat: 39.0955, lng: -84.5160 },
  { id: 'huntington-bank-field', league: 'NFL', division: 'AFC North', teams: ['Cleveland Browns'], name: 'Huntington Bank Field', aka: '', city: 'Cleveland', state: 'OH', lat: 41.5061, lng: -81.6995 },
  { id: 'acrisure-stadium', league: 'NFL', division: 'AFC North', teams: ['Pittsburgh Steelers'], name: 'Acrisure Stadium', aka: '', city: 'Pittsburgh', state: 'PA', lat: 40.4468, lng: -80.0158 },

  { id: 'nrg-stadium', league: 'NFL', division: 'AFC South', teams: ['Houston Texans'], name: 'NRG Stadium', aka: '', city: 'Houston', state: 'TX', lat: 29.6847, lng: -95.4107 },
  { id: 'lucas-oil-stadium', league: 'NFL', division: 'AFC South', teams: ['Indianapolis Colts'], name: 'Lucas Oil Stadium', aka: '', city: 'Indianapolis', state: 'IN', lat: 39.7601, lng: -86.1639 },
  { id: 'everbank-stadium', league: 'NFL', division: 'AFC South', teams: ['Jacksonville Jaguars'], name: 'EverBank Stadium', aka: '', city: 'Jacksonville', state: 'FL', lat: 30.3239, lng: -81.6373 },
  { id: 'nissan-stadium', league: 'NFL', division: 'AFC South', teams: ['Tennessee Titans'], name: 'Nissan Stadium', aka: '', city: 'Nashville', state: 'TN', lat: 36.1665, lng: -86.7713 },

  { id: 'empower-field', league: 'NFL', division: 'AFC West', teams: ['Denver Broncos'], name: 'Empower Field at Mile High', aka: '', city: 'Denver', state: 'CO', lat: 39.7439, lng: -105.0201 },
  { id: 'arrowhead-stadium', league: 'NFL', division: 'AFC West', teams: ['Kansas City Chiefs'], name: 'GEHA Field at Arrowhead Stadium', aka: '', city: 'Kansas City', state: 'MO', lat: 39.0489, lng: -94.4839 },
  { id: 'allegiant-stadium', league: 'NFL', division: 'AFC West', teams: ['Las Vegas Raiders'], name: 'Allegiant Stadium', aka: '', city: 'Las Vegas', state: 'NV', lat: 36.0909, lng: -115.1833 },
  { id: 'sofi-stadium', league: 'NFL', division: 'AFC West / NFC West', teams: ['Los Angeles Chargers', 'Los Angeles Rams'], name: 'SoFi Stadium', aka: 'Shared by Chargers & Rams', city: 'Inglewood', state: 'CA', lat: 33.9535, lng: -118.3392 },

  // ─── NFL · NFC ────────────────────────────────────────────────────────
  { id: 'att-stadium', league: 'NFL', division: 'NFC East', teams: ['Dallas Cowboys'], name: 'AT&T Stadium', aka: '', city: 'Arlington', state: 'TX', lat: 32.7473, lng: -97.0945 },
  { id: 'lincoln-financial-field', league: 'NFL', division: 'NFC East', teams: ['Philadelphia Eagles'], name: 'Lincoln Financial Field', aka: '', city: 'Philadelphia', state: 'PA', lat: 39.9008, lng: -75.1675 },
  { id: 'northwest-stadium', league: 'NFL', division: 'NFC East', teams: ['Washington Commanders'], name: 'Northwest Stadium', aka: 'FedExField', city: 'Landover', state: 'MD', lat: 38.9077, lng: -76.8645 },

  { id: 'soldier-field', league: 'NFL', division: 'NFC North', teams: ['Chicago Bears'], name: 'Soldier Field', aka: '', city: 'Chicago', state: 'IL', lat: 41.8623, lng: -87.6167 },
  { id: 'ford-field', league: 'NFL', division: 'NFC North', teams: ['Detroit Lions'], name: 'Ford Field', aka: '', city: 'Detroit', state: 'MI', lat: 42.3400, lng: -83.0456 },
  { id: 'lambeau-field', league: 'NFL', division: 'NFC North', teams: ['Green Bay Packers'], name: 'Lambeau Field', aka: '', city: 'Green Bay', state: 'WI', lat: 44.5013, lng: -88.0622 },
  { id: 'us-bank-stadium', league: 'NFL', division: 'NFC North', teams: ['Minnesota Vikings'], name: 'U.S. Bank Stadium', aka: '', city: 'Minneapolis', state: 'MN', lat: 44.9736, lng: -93.2575 },

  { id: 'mercedes-benz-stadium', league: 'NFL', division: 'NFC South', teams: ['Atlanta Falcons'], name: 'Mercedes-Benz Stadium', aka: '', city: 'Atlanta', state: 'GA', lat: 33.7554, lng: -84.4009 },
  { id: 'bank-of-america-stadium', league: 'NFL', division: 'NFC South', teams: ['Carolina Panthers'], name: 'Bank of America Stadium', aka: '', city: 'Charlotte', state: 'NC', lat: 35.2258, lng: -80.8528 },
  { id: 'caesars-superdome', league: 'NFL', division: 'NFC South', teams: ['New Orleans Saints'], name: 'Caesars Superdome', aka: '', city: 'New Orleans', state: 'LA', lat: 29.9510, lng: -90.0812 },
  { id: 'raymond-james-stadium', league: 'NFL', division: 'NFC South', teams: ['Tampa Bay Buccaneers'], name: 'Raymond James Stadium', aka: '', city: 'Tampa', state: 'FL', lat: 27.9759, lng: -82.5033 },

  { id: 'state-farm-stadium', league: 'NFL', division: 'NFC West', teams: ['Arizona Cardinals'], name: 'State Farm Stadium', aka: '', city: 'Glendale', state: 'AZ', lat: 33.5276, lng: -112.2626 },
  { id: 'levis-stadium', league: 'NFL', division: 'NFC West', teams: ['San Francisco 49ers'], name: "Levi's Stadium", aka: '', city: 'Santa Clara', state: 'CA', lat: 37.4030, lng: -121.9698 },
  { id: 'lumen-field', league: 'NFL', division: 'NFC West', teams: ['Seattle Seahawks'], name: 'Lumen Field', aka: '', city: 'Seattle', state: 'WA', lat: 47.5952, lng: -122.3316 },
];

/** Division display order per league. */
export const DIVISION_ORDER = {
  MLB: ['AL East', 'AL Central', 'AL West', 'NL East', 'NL Central', 'NL West'],
  NFL: [
    'AFC East', 'AFC North', 'AFC South', 'AFC West',
    'NFC East', 'NFC North', 'NFC South', 'NFC West',
    'AFC East / NFC East', 'AFC West / NFC West',
  ],
};

export const LEAGUE_META = {
  MLB: { label: 'Baseball', emoji: '⚾', accent: '#c8102e', total: STADIUMS.filter((s) => s.league === 'MLB').length },
  NFL: { label: 'Football', emoji: '🏈', accent: '#013369', total: STADIUMS.filter((s) => s.league === 'NFL').length },
};

export function stadiumsByLeague(league) {
  return STADIUMS.filter((s) => s.league === league);
}

export function getStadium(id) {
  return STADIUMS.find((s) => s.id === id);
}

/** Unique list of "City, ST" home-base options for the origin picker. */
export function homeBaseOptions() {
  const seen = new Map();
  for (const s of STADIUMS) {
    const label = `${s.city}, ${s.state}`;
    if (!seen.has(label)) seen.set(label, { label, lat: s.lat, lng: s.lng });
  }
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const R_MILES = 3958.8;
export function distanceMiles(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}
function toRad(d) { return (d * Math.PI) / 180; }

/** Rough drive-time estimate from straight-line miles (highway average). */
export function estimateDriveTime(miles) {
  const hours = miles / 60;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
