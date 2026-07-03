/**
 * Persistence layer.
 *
 * This is the seam where a future native app / backend plugs in. The UI only
 * ever calls this module — never localStorage or IndexedDB directly. To move
 * to a server or React Native, reimplement these functions against your API /
 * device storage and the rest of the app keeps working unchanged.
 *
 * Today: trip records live in localStorage (small JSON), photos live in
 * IndexedDB (binary-ish data URLs can be large). Everything is per-browser.
 */

const TRIPS_KEY = 'stadiumTracker.trips.v1';
const HOME_KEY = 'stadiumTracker.home.v1';
const DB_NAME = 'stadiumTracker';
const DB_STORE = 'photos';

/**
 * @typedef {Object} TripRecord
 * @property {boolean} visited
 * @property {string} date      YYYY-MM-DD or ''
 * @property {number} rating    0-5
 * @property {string} notes
 * @property {string} hotel     hotel / resort where you stayed
 * @property {string} flight    flight / travel details
 */

export function emptyTrip() {
  return { visited: false, date: '', rating: 0, notes: '', hotel: '', flight: '' };
}

// ─── Trip records (localStorage) ────────────────────────────────────────

export function loadTrips() {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getTrip(id) {
  const trips = loadTrips();
  return { ...emptyTrip(), ...(trips[id] || {}) };
}

export function saveTrip(id, record) {
  const trips = loadTrips();
  trips[id] = { ...emptyTrip(), ...record };
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

export function loadHome() {
  try {
    const raw = localStorage.getItem(HOME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveHome(home) {
  if (home) localStorage.setItem(HOME_KEY, JSON.stringify(home));
  else localStorage.removeItem(HOME_KEY);
}

// ─── Photos (IndexedDB) ─────────────────────────────────────────────────

let _dbPromise = null;
function db() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(DB_STORE)) {
        d.createObjectStore(DB_STORE, { keyPath: 'key', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode) {
  return db().then((d) => d.transaction(DB_STORE, mode).objectStore(DB_STORE));
}

/** @returns {Promise<{key:number, dataUrl:string, caption:string}[]>} */
export async function getPhotos(stadiumId) {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const out = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      if (cursor.value.stadiumId === stadiumId) out.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addPhoto(stadiumId, dataUrl, caption = '') {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({ stadiumId, dataUrl, caption, addedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePhoto(key) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function countPhotos(stadiumId) {
  const photos = await getPhotos(stadiumId);
  return photos.length;
}

/**
 * One cursor scan returning { [stadiumId]: {count, cover} } for cheap card
 * thumbnails, instead of a per-card query.
 * @returns {Promise<Record<string,{count:number, cover:string}>>}
 */
export async function getPhotoIndex() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const idx = {};
    const req = store.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(idx);
      const { stadiumId, dataUrl } = c.value;
      if (!idx[stadiumId]) idx[stadiumId] = { count: 0, cover: dataUrl };
      idx[stadiumId].count += 1;
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Backup / restore (JSON, portable to any future app) ────────────────

export async function exportAll() {
  const trips = loadTrips();
  const home = loadHome();
  const store = await tx('readonly');
  const photos = await new Promise((resolve, reject) => {
    const out = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      out.push(c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return { version: 1, exportedAt: new Date().toISOString(), trips, home, photos };
}

export async function importAll(payload) {
  if (!payload || payload.version !== 1) throw new Error('Unrecognized backup file.');
  if (payload.trips) localStorage.setItem(TRIPS_KEY, JSON.stringify(payload.trips));
  if (payload.home) saveHome(payload.home);
  if (Array.isArray(payload.photos)) {
    const store = await tx('readwrite');
    await Promise.all(
      payload.photos.map(
        (p) =>
          new Promise((resolve, reject) => {
            const rec = { stadiumId: p.stadiumId, dataUrl: p.dataUrl, caption: p.caption || '', addedAt: p.addedAt };
            const req = store.add(rec);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          }),
      ),
    );
  }
}
