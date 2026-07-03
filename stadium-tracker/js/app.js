/**
 * Stadium Trip Tracker — UI controller.
 *
 * Pure DOM + the data/storage modules. No framework, no build step, so it runs
 * from a static server as-is. Kept deliberately modular (data / storage / view)
 * so it ports cleanly to React / React Native: the render functions become
 * components and the storage module becomes your API/device layer.
 */

import {
  STADIUMS, DIVISION_ORDER, LEAGUE_META,
  stadiumsByLeague, getStadium, homeBaseOptions, distanceMiles, estimateDriveTime,
} from './data.js';
import * as Store from './storage.js';

const state = {
  league: 'MLB',
  filter: 'all',       // all | visited | todo
  query: '',
  home: Store.loadHome(),   // {label, lat, lng} | null
  photoIndex: {},           // stadiumId -> {count, cover}
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

// ─── Boot ───────────────────────────────────────────────────────────────

async function boot() {
  state.photoIndex = await Store.getPhotoIndex();
  renderChrome();
  renderHomeOptions();
  render();
  wireGlobal();
}

// ─── Static chrome (tabs, controls) ─────────────────────────────────────

function renderChrome() {
  const tabs = $('#tabs');
  tabs.innerHTML = '';
  for (const lg of ['MLB', 'NFL']) {
    const meta = LEAGUE_META[lg];
    const visited = countVisited(lg);
    const btn = el('button', 'tab',
      `<span>${meta.emoji}</span> ${lg} <span class="count">${visited}/${meta.total}</span>`);
    btn.setAttribute('aria-selected', String(state.league === lg));
    btn.onclick = () => { state.league = lg; document.body.dataset.league = lg; render(); renderChrome(); };
    tabs.appendChild(btn);
  }
}

function renderHomeOptions() {
  const sel = $('#homeSelect');
  sel.innerHTML = '<option value="">Set home base…</option>';
  for (const opt of homeBaseOptions()) {
    const o = el('option');
    o.value = JSON.stringify(opt);
    o.textContent = opt.label;
    if (state.home && state.home.label === opt.label) o.selected = true;
    sel.appendChild(o);
  }
}

// ─── Render main view ───────────────────────────────────────────────────

function render() {
  renderProgress();
  renderGrid();
}

function countVisited(league) {
  const trips = Store.loadTrips();
  return stadiumsByLeague(league).filter((s) => trips[s.id]?.visited).length;
}

function renderProgress() {
  const meta = LEAGUE_META[state.league];
  const total = meta.total;
  const visited = countVisited(state.league);
  const pct = total ? Math.round((visited / total) * 100) : 0;

  // Ring
  const r = 34, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  $('#progressRing').innerHTML = `
    <svg width="86" height="86" viewBox="0 0 86 86">
      <circle cx="43" cy="43" r="${r}" fill="none" stroke="var(--accent-soft)" stroke-width="9"/>
      <circle cx="43" cy="43" r="${r}" fill="none" stroke="var(--accent)" stroke-width="9"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
    </svg>
    <span class="pct">${pct}%</span>`;

  $('#progressCopy').innerHTML = `
    <h2>${visited} of ${total} ${meta.label.toLowerCase()} stadiums visited</h2>
    <p>${total - visited} left on the bucket list${state.home ? ` · home base: ${escapeHtml(state.home.label)}` : ''}</p>`;

  // Division bars
  const trips = Store.loadTrips();
  const bars = $('#divisionBars');
  bars.innerHTML = '';
  for (const div of DIVISION_ORDER[state.league]) {
    const inDiv = STADIUMS.filter((s) => s.league === state.league && s.division === div);
    if (inDiv.length === 0) continue;
    const done = inDiv.filter((s) => trips[s.id]?.visited).length;
    const bar = el('div', 'div-bar', `
      <div class="label"><span>${div}</span><span>${done}/${inDiv.length}</span></div>
      <div class="track"><div class="fill" style="width:${(done / inDiv.length) * 100}%"></div></div>`);
    bars.appendChild(bar);
  }
}

function passesFilter(stadium, trip) {
  if (state.filter === 'visited' && !trip.visited) return false;
  if (state.filter === 'todo' && trip.visited) return false;
  if (state.query) {
    const q = state.query.toLowerCase();
    const hay = `${stadium.name} ${stadium.aka} ${stadium.city} ${stadium.state} ${stadium.teams.join(' ')} ${stadium.division}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderGrid() {
  const main = $('#main');
  main.innerHTML = '';
  const trips = Store.loadTrips();
  let shown = 0;

  for (const div of DIVISION_ORDER[state.league]) {
    const inDiv = STADIUMS.filter((s) => s.league === state.league && s.division === div);
    const visible = inDiv.filter((s) => passesFilter(s, { ...Store.emptyTrip(), ...trips[s.id] }));
    if (visible.length === 0) continue;
    shown += visible.length;

    const done = inDiv.filter((s) => trips[s.id]?.visited).length;
    const group = el('section', 'division-group');
    group.appendChild(el('h3', 'division-title',
      `${div} <span class="tally">· ${done}/${inDiv.length}</span>`));
    const grid = el('div', 'grid');
    visible.forEach((s) => grid.appendChild(card(s, { ...Store.emptyTrip(), ...trips[s.id] })));
    group.appendChild(grid);
    main.appendChild(group);
  }

  if (shown === 0) {
    main.appendChild(el('div', 'empty',
      `<div style="font-size:40px">🔎</div><p>No stadiums match your filters.</p>`));
  }
}

function card(s, trip) {
  const node = el('article', `card${trip.visited ? ' visited' : ''}`);
  const cover = state.photoIndex[s.id]?.cover;
  const photoCount = state.photoIndex[s.id]?.count || 0;

  const thumb = el('div', 'card-thumb');
  thumb.innerHTML = cover
    ? `<img src="${cover}" alt="${escapeHtml(s.name)}">`
    : `<span class="placeholder">${LEAGUE_META[s.league].emoji}</span>`;
  thumb.appendChild(el('span', 'card-badge', trip.visited ? '✓ Visited' : 'To visit'));
  node.appendChild(thumb);

  const dist = distanceBlock(s);
  const body = el('div', 'card-body', `
    <div class="card-team">${escapeHtml(s.teams.join(' · '))}</div>
    <h4 class="card-name">${escapeHtml(s.name)}</h4>
    <div class="card-city">${escapeHtml(s.city)}, ${s.state}${photoCount ? ` · ${photoCount} 📷` : ''}</div>
    ${dist ? `<div class="card-dist">${dist}</div>` : ''}
    ${trip.visited && trip.rating ? `<div class="card-dist">${starHtml(trip.rating)}</div>` : ''}`);

  const actions = el('div', 'card-actions');
  const directions = el('a', 'chip-btn', '🧭 Directions');
  directions.href = directionsUrl(s);
  directions.target = '_blank'; directions.rel = 'noopener';
  const details = el('button', 'chip-btn', '📝 Details');
  details.onclick = () => openModal(s.id);
  const toggle = el('button', 'visit-toggle', trip.visited ? '✓ Visited' : 'Mark visited');
  toggle.onclick = (e) => { e.stopPropagation(); quickToggle(s.id); };

  actions.append(directions, details, toggle);
  body.appendChild(actions);
  node.appendChild(body);
  node.querySelector('.card-name').style.cursor = 'pointer';
  node.querySelector('.card-name').onclick = () => openModal(s.id);
  return node;
}

function distanceBlock(s) {
  if (!state.home) return '';
  const mi = Math.round(distanceMiles(state.home, s));
  return `📍 ~${mi.toLocaleString()} mi · 🚗 ${estimateDriveTime(mi)} <span style="opacity:.6">(direct)</span>`;
}

function quickToggle(id) {
  const trip = Store.getTrip(id);
  trip.visited = !trip.visited;
  if (trip.visited && !trip.date) trip.date = new Date().toISOString().slice(0, 10);
  Store.saveTrip(id, trip);
  render();
  renderChrome();
  toast(trip.visited ? 'Marked as visited ✓' : 'Moved back to bucket list');
}

// ─── Modal ──────────────────────────────────────────────────────────────

let modalId = null;

async function openModal(id) {
  modalId = id;
  const s = getStadium(id);
  const trip = Store.getTrip(id);
  const backdrop = $('#modalBackdrop');

  $('#modalHero').innerHTML = `
    <div>
      <div class="m-team">${escapeHtml(s.teams.join(' · '))}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <div class="m-city">${escapeHtml(s.city)}, ${s.state}${s.aka ? ` · ${escapeHtml(s.aka)}` : ''}</div>
    </div>
    <button class="modal-close" id="modalClose" aria-label="Close">✕</button>`;

  const body = $('#modalBody');
  body.innerHTML = `
    <div class="visit-row">
      <button class="big-toggle${trip.visited ? ' on' : ''}" id="mVisited">
        ${trip.visited ? '✓ Visited' : '○ Not visited yet'}
      </button>
      <div class="field" style="flex:1; min-width:150px">
        <label>Date visited</label>
        <input type="date" id="mDate" value="${trip.date || ''}">
      </div>
      <div>
        <label style="display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:6px">Your rating</label>
        <div class="rate-stars" id="mStars">${[1,2,3,4,5].map((i) =>
          `<span class="s ${i <= trip.rating ? 'on' : ''}" data-v="${i}">★</span>`).join('')}</div>
      </div>
    </div>

    ${state.home ? `<div class="dist-callout">🚗 About <strong>${Math.round(distanceMiles(state.home, s)).toLocaleString()} mi</strong>
      (~${estimateDriveTime(distanceMiles(state.home, s))} drive) from ${escapeHtml(state.home.label)}
      <span style="opacity:.6">— straight-line estimate</span></div>` : ''}

    <div class="travel-links">
      <a class="link-btn" href="${directionsUrl(s)}" target="_blank" rel="noopener">🧭 Driving directions</a>
      <a class="link-btn" href="${hotelsUrl(s)}" target="_blank" rel="noopener">🏨 Hotels & resorts nearby</a>
      <a class="link-btn" href="${flightsUrl(s)}" target="_blank" rel="noopener">✈️ Find flights</a>
      <a class="link-btn" href="${mapUrl(s)}" target="_blank" rel="noopener">🗺️ View on map</a>
    </div>

    <div class="grid-2">
      <div class="field"><label>🏨 Hotel / resort stay</label>
        <input id="mHotel" placeholder="Where did you stay?" value="${escapeAttr(trip.hotel)}"></div>
      <div class="field"><label>✈️ Flight / travel details</label>
        <input id="mFlight" placeholder="Airline, confirmation #, etc." value="${escapeAttr(trip.flight)}"></div>
    </div>

    <div class="field"><label>📝 Notes & memories</label>
      <textarea id="mNotes" placeholder="Best hot dog, seats, who you went with, the game…">${escapeHtml(trip.notes)}</textarea></div>

    <div>
      <p class="section-label">📷 Photos</p>
      <div class="photos" id="mPhotos"></div>
    </div>

    <div style="display:flex;align-items:center;gap:12px">
      <button class="ghost-btn" id="mSave" style="background:var(--accent);border-color:var(--accent)">Save trip</button>
      <span class="saved-flash" id="mFlash">Saved ✓</span>
    </div>`;

  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';

  $('#modalClose').onclick = closeModal;
  $('#mVisited').onclick = () => {
    const t = collectModal();
    t.visited = !t.visited;
    if (t.visited && !t.date) t.date = new Date().toISOString().slice(0, 10);
    Store.saveTrip(id, t);
    openModal(id); // re-render toggle + date
    render(); renderChrome();
  };
  $('#mStars').querySelectorAll('.s').forEach((star) => {
    star.onclick = () => {
      const v = Number(star.dataset.v);
      const t = collectModal();
      t.rating = t.rating === v ? 0 : v;
      Store.saveTrip(id, t);
      $('#mStars').querySelectorAll('.s').forEach((x, i) =>
        x.classList.toggle('on', i < t.rating));
    };
  });
  $('#mSave').onclick = () => { saveModal(); };
  // Autosave text fields on blur
  ['mDate', 'mHotel', 'mFlight', 'mNotes'].forEach((fid) => {
    $('#' + fid).addEventListener('change', saveModal);
  });

  await renderPhotos(id);
}

function collectModal() {
  const trip = Store.getTrip(modalId);
  return {
    visited: $('#mVisited').classList.contains('on'),
    date: $('#mDate').value,
    rating: trip.rating,
    notes: $('#mNotes').value,
    hotel: $('#mHotel').value,
    flight: $('#mFlight').value,
  };
}

function saveModal() {
  if (!modalId) return;
  Store.saveTrip(modalId, collectModal());
  const flash = $('#mFlash');
  flash.classList.add('show');
  setTimeout(() => flash.classList.remove('show'), 1200);
  render(); renderChrome();
}

async function renderPhotos(id) {
  const wrap = $('#mPhotos');
  if (!wrap) return;
  const photos = await Store.getPhotos(id);
  wrap.innerHTML = '';

  const tile = el('label', 'upload-tile', '＋<br>Add photos<input type="file" accept="image/*" multiple>');
  tile.querySelector('input').addEventListener('change', (e) => handleUpload(id, e.target.files));
  wrap.appendChild(tile);

  for (const p of photos) {
    const cell = el('div', 'photo');
    cell.innerHTML = `<img src="${p.dataUrl}" alt="${escapeAttr(p.caption)}">
      <button class="del" title="Delete photo">✕</button>`;
    cell.querySelector('.del').onclick = async () => {
      await Store.deletePhoto(p.key);
      state.photoIndex = await Store.getPhotoIndex();
      await renderPhotos(id);
      renderGrid();
    };
    wrap.appendChild(cell);
  }
}

async function handleUpload(id, files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  toast(`Adding ${list.length} photo${list.length > 1 ? 's' : ''}…`);
  for (const file of list) {
    try {
      const dataUrl = await downscale(file, 1400, 0.82);
      await Store.addPhoto(id, dataUrl);
    } catch {
      toast('Could not read a photo');
    }
  }
  state.photoIndex = await Store.getPhotoIndex();
  await renderPhotos(id);
  renderGrid();
  toast('Photos saved ✓');
}

/** Read + downscale an image file to a JPEG data URL to keep storage small. */
function downscale(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function closeModal() {
  modalId = null;
  $('#modalBackdrop').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── External travel links ──────────────────────────────────────────────

function directionsUrl(s) {
  const dest = `${s.lat},${s.lng}`;
  const origin = state.home ? `&origin=${state.home.lat},${state.home.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=driving`;
}
function mapUrl(s) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' ' + s.city)}`;
}
function hotelsUrl(s) {
  return `https://www.google.com/maps/search/${encodeURIComponent('hotels and resorts near ' + s.name + ' ' + s.city + ' ' + s.state)}`;
}
function flightsUrl(s) {
  return `https://www.google.com/travel/flights?q=${encodeURIComponent('flights to ' + s.city + ' ' + s.state)}`;
}

// ─── Global wiring ──────────────────────────────────────────────────────

function wireGlobal() {
  $('#search').addEventListener('input', (e) => { state.query = e.target.value; renderGrid(); });

  $('#filters').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      state.filter = b.dataset.filter;
      $('#filters').querySelectorAll('button').forEach((x) =>
        x.setAttribute('aria-pressed', String(x === b)));
      renderGrid();
    };
  });

  $('#homeSelect').addEventListener('change', (e) => {
    state.home = e.target.value ? JSON.parse(e.target.value) : null;
    Store.saveHome(state.home);
    render();
    toast(state.home ? `Home base set to ${state.home.label}` : 'Home base cleared');
  });

  $('#useLocation').onclick = () => {
    if (!navigator.geolocation) return toast('Geolocation not available');
    toast('Locating…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.home = { label: 'My current location', lat: pos.coords.latitude, lng: pos.coords.longitude };
        Store.saveHome(state.home);
        renderHomeOptions();
        render();
        toast('Home base set to your location');
      },
      () => toast('Could not get your location'),
    );
  };

  $('#exportBtn').onclick = doExport;
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').addEventListener('change', doImport);

  $('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target === $('#modalBackdrop')) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

async function doExport() {
  const data = await Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = `stadium-trips-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded ✓');
}

async function doImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    await Store.importAll(payload);
    state.home = Store.loadHome();
    state.photoIndex = await Store.getPhotoIndex();
    renderHomeOptions();
    render(); renderChrome();
    toast('Backup restored ✓');
  } catch (err) {
    toast('Import failed: ' + err.message);
  } finally {
    e.target.value = '';
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function starHtml(n) {
  return `<span class="stars">${[1,2,3,4,5].map((i) =>
    `<span class="s ${i <= n ? 'on' : ''}">★</span>`).join('')}</span>`;
}
function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(str = '') { return escapeHtml(str); }

document.body.dataset.league = state.league;
boot();
