/**
 * Supabase cloud sync — the seam that makes trips, notes and photos follow you
 * across devices.
 *
 * Design: the app stays **local-first**. storage.js remains the working store
 * (fast, offline). This module lazily loads the Supabase SDK only when you turn
 * sync on, then two-way syncs the local store with Supabase using
 * last-write-wins on trips (by updated_at) and additive id-based merge on
 * photos. Every remote call is best-effort — if you're offline or not signed
 * in, the app keeps working and just doesn't sync.
 *
 * Reuses the same Supabase project as the Friday app. The URL + anon key are
 * public (safe in client code); point them at your own project by editing the
 * two constants below and running supabase-sync.sql there.
 */

import * as Store from './storage.js';

const SUPABASE_URL = 'https://mtunnqfzryxmiygywqxd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_I11kwLYciuddH_w4jEEIRw_Z4k_WVWe';
const ENABLED_FLAG = 'stadiumTracker.syncEnabled.v1';

let _client = null;
let _sdkPromise = null;
let _user = null;

// ─── SDK + client bootstrap (lazy) ──────────────────────────────────────

function loadSdk() {
  if (window.supabase) return Promise.resolve();
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/supabase.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the sync engine (are you offline?).'));
    document.head.appendChild(s);
  });
  return _sdkPromise;
}

async function client() {
  if (_client) return _client;
  await loadSdk();
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.localStorage,
    },
  });
  return _client;
}

// ─── Auth ───────────────────────────────────────────────────────────────

export function syncWasEnabled() {
  return localStorage.getItem(ENABLED_FLAG) === '1';
}

export function currentUser() {
  return _user;
}

/** Restore a persisted session (for returning users) without forcing sign-in. */
export async function restore() {
  if (!syncWasEnabled()) return null;
  const c = await client();
  const { data } = await c.auth.getSession();
  _user = data.session?.user ?? null;
  return _user;
}

export async function signUp(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signUp({ email, password });
  if (error) throw error;
  _user = data.session?.user ?? data.user ?? null;
  if (_user) localStorage.setItem(ENABLED_FLAG, '1');
  return { user: _user, needsConfirmation: !data.session };
}

export async function signIn(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _user = data.user;
  localStorage.setItem(ENABLED_FLAG, '1');
  return _user;
}

export async function signOut() {
  const c = await client();
  await c.auth.signOut();
  _user = null;
  localStorage.removeItem(ENABLED_FLAG);
}

// ─── Row <-> record mapping ─────────────────────────────────────────────

function rowToTrip(r) {
  return {
    visited: !!r.visited,
    date: r.date || '',
    rating: r.rating || 0,
    notes: r.notes || '',
    hotel: r.hotel || '',
    flight: r.flight || '',
    updatedAt: r.updated_at || '',
  };
}

function tripToRow(userId, id, t) {
  return {
    user_id: userId,
    stadium_id: id,
    visited: !!t.visited,
    date: t.date || '',
    rating: t.rating || 0,
    notes: t.notes || '',
    hotel: t.hotel || '',
    flight: t.flight || '',
    updated_at: t.updatedAt || new Date().toISOString(),
  };
}

// ─── Incremental push (best-effort, called on local changes) ────────────

export async function pushTrip(id, trip) {
  if (!_user || !_client) return;
  try {
    await _client.from('stadium_trips').upsert(tripToRow(_user.id, id, trip), {
      onConflict: 'user_id,stadium_id',
    });
  } catch { /* offline / table missing — non-fatal */ }
}

export async function pushPhoto(photo) {
  if (!_user || !_client) return;
  try {
    await _client.from('stadium_photos').insert({
      id: photo.id,
      user_id: _user.id,
      stadium_id: photo.stadiumId,
      data_url: photo.dataUrl,
      caption: photo.caption || '',
    });
  } catch { /* non-fatal */ }
}

export async function deletePhotoRemote(id) {
  if (!_user || !_client) return;
  try {
    await _client.from('stadium_photos').delete().eq('id', id);
  } catch { /* non-fatal */ }
}

// ─── Full two-way sync ──────────────────────────────────────────────────

/**
 * Reconcile local store with Supabase. Returns a summary or throws with a
 * user-readable message (e.g. tables not created yet).
 */
export async function fullSync() {
  const c = await client();
  const { data: sess } = await c.auth.getSession();
  _user = sess.session?.user ?? null;
  if (!_user) throw new Error('Sign in to sync.');
  const uid = _user.id;

  // ── Trips (last-write-wins by updated_at) ──
  const localTrips = Store.loadTrips();
  const { data: remoteTrips, error: e1 } = await c
    .from('stadium_trips').select('*').eq('user_id', uid);
  if (e1) throw friendly(e1);

  const remoteById = {};
  for (const r of remoteTrips) remoteById[r.stadium_id] = r;

  let pulled = 0;
  for (const r of remoteTrips) {
    const l = localTrips[r.stadium_id];
    if (!l || (r.updated_at || '') > (l.updatedAt || '')) {
      Store.saveTrip(r.stadium_id, rowToTrip(r), { bump: false });
      pulled++;
    }
  }

  const upserts = [];
  for (const [id, l] of Object.entries(Store.loadTrips())) {
    const r = remoteById[id];
    if (!r || (l.updatedAt || '') > (r.updated_at || '')) {
      // Only push records that actually carry data.
      if (l.visited || l.notes || l.hotel || l.flight || l.rating || l.date) {
        upserts.push(tripToRow(uid, id, l));
      }
    }
  }
  if (upserts.length) {
    const { error } = await c.from('stadium_trips').upsert(upserts, { onConflict: 'user_id,stadium_id' });
    if (error) throw friendly(error);
  }

  // ── Photos (additive, id-based) ──
  const { data: remotePhotos, error: e2 } = await c
    .from('stadium_photos').select('*').eq('user_id', uid);
  if (e2) throw friendly(e2);

  const localPhotos = await Store.getAllPhotos();
  const localIds = new Set(localPhotos.map((p) => p.id).filter(Boolean));
  const remoteIds = new Set(remotePhotos.map((p) => p.id));

  let photosPulled = 0;
  for (const rp of remotePhotos) {
    if (!localIds.has(rp.id)) {
      await Store.addPhotoWithId(rp.id, rp.stadium_id, rp.data_url, rp.caption || '', rp.created_at);
      photosPulled++;
    }
  }

  const photoInserts = localPhotos
    .filter((p) => p.id && !remoteIds.has(p.id))
    .map((p) => ({ id: p.id, user_id: uid, stadium_id: p.stadiumId, data_url: p.dataUrl, caption: p.caption || '' }));
  if (photoInserts.length) {
    const { error } = await c.from('stadium_photos').insert(photoInserts);
    if (error) throw friendly(error);
  }

  return {
    tripsPulled: pulled,
    tripsPushed: upserts.length,
    photosPulled,
    photosPushed: photoInserts.length,
    at: new Date().toISOString(),
  };
}

function friendly(error) {
  const msg = String(error?.message || error);
  if (/relation .* does not exist|schema cache|Could not find the table/i.test(msg)) {
    return new Error('Sync tables not found. Run supabase-sync.sql in your Supabase project first.');
  }
  return new Error(msg);
}
