/**
 * Self-contained US map renderer.
 *
 * Draws the lower-48 state outlines and plots stadium pins, all as inline SVG
 * with an Albers equal-area conic projection — no map tiles, no external
 * service, works offline. Because the same projection transforms both the
 * state polygons and the pins, pins land in the right place.
 */

import { US_STATES } from './us-geo.js';

const WIDTH = 960;
const HEIGHT = 600;
const PAD = 20;

// Albers USA conic parameters (continental US).
const LON0 = -96, LAT0 = 37.5, PHI1 = 29.5, PHI2 = 45.5;
const D2R = Math.PI / 180;

function albersRaw(lng, lat) {
  const n = (Math.sin(PHI1 * D2R) + Math.sin(PHI2 * D2R)) / 2;
  const c = Math.cos(PHI1 * D2R) ** 2 + 2 * n * Math.sin(PHI1 * D2R);
  const rho = Math.sqrt(c - 2 * n * Math.sin(lat * D2R)) / n;
  const rho0 = Math.sqrt(c - 2 * n * Math.sin(LAT0 * D2R)) / n;
  const theta = n * ((lng - LON0) * D2R);
  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

// Precompute a fit-to-viewport transform from the state geometry bounds.
const _fit = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of US_STATES.features) {
    eachRing(f.geometry, (ring) => {
      for (const [lng, lat] of ring) {
        const [x, y] = albersRaw(lng, lat);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    });
  }
  const scale = Math.min((WIDTH - PAD * 2) / (maxX - minX), (HEIGHT - PAD * 2) / (maxY - minY));
  const tx = PAD + ((WIDTH - PAD * 2) - (maxX - minX) * scale) / 2 - minX * scale;
  const ty = PAD + ((HEIGHT - PAD * 2) - (maxY - minY) * scale) / 2 - minY * scale;
  return { scale, tx, ty };
})();

/** Project [lng,lat] to SVG [x,y]. */
export function project(lng, lat) {
  const [x, y] = albersRaw(lng, lat);
  return [x * _fit.scale + _fit.tx, y * _fit.scale + _fit.ty];
}

function eachRing(geom, fn) {
  if (geom.type === 'Polygon') geom.coordinates.forEach(fn);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((poly) => poly.forEach(fn));
}

function statePath(geom) {
  let d = '';
  eachRing(geom, (ring) => {
    ring.forEach(([lng, lat], i) => {
      const [x, y] = project(lng, lat);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    });
    d += 'Z';
  });
  return d;
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

/**
 * Render the map into a container element.
 * @param {HTMLElement} container
 * @param {Array} stadiums          stadiums for the active league
 * @param {(id:string)=>object} tripFor   returns the trip record for a stadium id
 * @param {(id:string)=>void} onPinClick
 * @param {{lat:number,lng:number,label:string}|null} home
 */
export function renderMap(container, stadiums, tripFor, onPinClick, home) {
  container.innerHTML = '';
  const root = svg('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    class: 'us-map',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'Map of stadiums across the United States',
  });

  // State outlines
  const gStates = svg('g', { class: 'map-states' });
  for (const f of US_STATES.features) {
    gStates.appendChild(svg('path', { d: statePath(f.geometry), class: 'map-state' }));
  }
  root.appendChild(gStates);

  // Home base marker
  if (home) {
    const [hx, hy] = project(home.lng, home.lat);
    const g = svg('g', { class: 'map-home', transform: `translate(${hx.toFixed(1)},${hy.toFixed(1)})` });
    g.appendChild(svg('circle', { r: 11, class: 'home-halo' }));
    const star = svg('text', { class: 'home-star', 'text-anchor': 'middle', y: 5 });
    star.textContent = '★';
    g.appendChild(star);
    const t = svg('title'); t.textContent = `Home base: ${home.label}`; g.appendChild(t);
    root.appendChild(g);
  }

  // Pins — draw unvisited first so visited pins sit on top.
  const ordered = [...stadiums].sort((a, b) => Number(!!tripFor(a.id).visited) - Number(!!tripFor(b.id).visited));
  const gPins = svg('g', { class: 'map-pins' });
  for (const s of ordered) {
    const trip = tripFor(s.id);
    const [x, y] = project(s.lng, s.lat);
    const pin = svg('g', {
      class: `map-pin${trip.visited ? ' visited' : ''}`,
      transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${s.name}, ${s.city} — ${trip.visited ? 'visited' : 'not visited'}`,
    });
    pin.appendChild(svg('circle', { r: 7, class: 'pin-dot' }));
    if (trip.visited) {
      const check = svg('text', { class: 'pin-check', 'text-anchor': 'middle', y: 3.4 });
      check.textContent = '✓';
      pin.appendChild(check);
    }
    const title = svg('title');
    title.textContent = `${s.name} · ${s.city}, ${s.state}${trip.visited ? ' · ✓ visited' : ''}`;
    pin.appendChild(title);
    pin.addEventListener('click', () => onPinClick(s.id));
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPinClick(s.id); } });
    gPins.appendChild(pin);
  }
  root.appendChild(gPins);

  container.appendChild(root);
}
