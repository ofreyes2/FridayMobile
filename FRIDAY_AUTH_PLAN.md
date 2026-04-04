# FridayMobile Multi-User Auth Implementation Plan

## Executive Summary

Add Supabase authentication to FridayMobile to enable multi-user support with per-user chat history, personality state, and relationship data. Reuse PantryIQ's proven auth patterns while adapting for Friday's unique conversation memory system.

**Supabase Project**: `mtunnqfzryxmiygywqxd` (shared with PantryIQ)
**Status**: Not implemented. FridayMobile currently has zero auth/Supabase integration.

---

## 1. Current State Analysis

### FridayMobile
- ✗ NO Supabase auth setup
- ✗ NO `@supabase/supabase-js` dependency
- ✗ Single-user only (data stored in AsyncStorage + expo-sqlite)
- ✓ Local Friday memory system (SQLite with types defined)
- ✓ User profile structure (name, timezone in AsyncStorage)
- Files: `lib/friday/{fridayMemory.ts, fridayContext.ts, fridayStore.ts, types.ts}`

### PantryIQ (Reference Implementation)
- ✓ Auth system fully implemented and battle-tested
- ✓ `@supabase/supabase-js@^2.98.0` installed
- ✓ `src/lib/auth.ts` — signUp, signIn, signOut, getSession, getUser, onAuthStateChange
- ✓ `src/lib/supabase.ts` — client init with AsyncStorage persistence
- ✓ `src/lib/devAuth.ts` — dev mode auto-login
- ✓ `src/lib/useSupabaseSync.ts` — hook that hydrates stores on auth change
- ✓ `src/lib/db.ts` — data access layer with camelCase ↔ snake_case mapping
- User metadata stored in `auth.user.user_metadata.name`

### Supabase Project Status
- Same project ID (`mtunnqfzryxmiygywqxd`) used by both apps
- User table already exists (managed by Supabase auth)
- Public schema ready for Friday tables

---

## 2. What to Reuse from PantryIQ

### Copy These Files Exactly
1. **`lib/auth.ts`** — auth module (signUp, signIn, signOut, getSession, getUser, onAuthStateChange, resetPassword)
2. **`lib/supabase.ts`** — Supabase client init with proper AsyncStorage integration and autoRefreshToken
3. **`lib/devAuth.ts`** — dev mode auto-login helper

### Adapt These Concepts
1. **`lib/useSupabaseSync.ts` pattern** — Hook that:
   - Listens to `supabase.auth.onAuthStateChange()`
   - On SIGN_IN: fetches Friday data from Supabase and hydrates local SQLite + Zustand stores
   - On SIGN_OUT: clears Friday data and resets stores
   - Prevents re-sync with `hasSynced` ref

2. **`lib/db.ts` layer** — Create `lib/fridayDb.ts` with:
   - Type mappers (camelCase TypeScript ↔ snake_case SQL)
   - CRUD operations (fetch, upsert, delete)
   - Error handling that logs but doesn't throw (app works offline)

3. **Zustand stores pattern** — Already using Zustand in FridayMobile (fridayStore.ts)
   - Add setters for remote sync state (isLoading, lastSyncTime)

---

## 3. Database Schema: New Supabase Tables

### Table 1: `friday_conversations`
Store all user-Friday chat messages with timing.

```sql
CREATE TABLE friday_conversations (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT NOT NULL,  -- e.g., "llama3.3:70b"
  timestamp BIGINT NOT NULL, -- Date.now()
  source TEXT,               -- 'user', 'ollama', 'voice'
  tokens_used INT,           -- for future analytics
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_friday_conversations_user_id ON friday_conversations(user_id);
CREATE INDEX idx_friday_conversations_timestamp ON friday_conversations(user_id, timestamp DESC);
```

### Table 2: `friday_memories`
Learned facts, preferences, and observations about the user.

```sql
CREATE TABLE friday_memories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preference', 'fact', 'learning')),
  content TEXT NOT NULL,
  relevance_score REAL DEFAULT 0.5,  -- 0.0 to 1.0
  learned_at BIGINT NOT NULL,        -- Date.now()
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_friday_memories_user_id ON friday_memories(user_id);
CREATE INDEX idx_friday_memories_type ON friday_memories(user_id, type);
CREATE INDEX idx_friday_memories_learned_at ON friday_memories(user_id, learned_at DESC);
```

### Table 3: `friday_personalities`
Per-user Friday relationship state (warmth level, personality evolution).

```sql
CREATE TABLE friday_personalities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Friday',
  traits TEXT[] DEFAULT '{"calm", "precise", "witty", "helpful", "thoughtful"}',
  communication_style TEXT DEFAULT 'friendly',
  interests TEXT[] DEFAULT '{"problem-solving", "learning", "conversation", "precision"}',
  interaction_count INT DEFAULT 0,       -- total chats
  warmth_level TEXT DEFAULT 'cool',      -- calculated from interaction_count
  last_interaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_friday_personalities_user_id ON friday_personalities(user_id);
```

### Table 4: `friday_user_profiles` (extends auth.users)
Additional Friday-specific user data beyond Supabase auth fields.

```sql
CREATE TABLE friday_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  timezone TEXT DEFAULT 'UTC',
  avatar_uri TEXT,
  first_message_at TIMESTAMP,
  last_message_at TIMESTAMP,
  total_messages INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Implementation Architecture

### Phase 1: Auth Foundation (Day 1)
1. Add `@supabase/supabase-js` to package.json
2. Add `.env` variables (copy from PantryIQ):
   - `EXPO_PUBLIC_SUPABASE_URL=https://mtunnqfzryxmiygywqxd.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY=...`
   - `EXPO_PUBLIC_TEST_EMAIL=...` (dev only)
   - `EXPO_PUBLIC_TEST_PASSWORD=...` (dev only)
3. Create `lib/supabase.ts` (copy from PantryIQ)
4. Create `lib/auth.ts` (copy from PantryIQ)
5. Create `lib/devAuth.ts` (copy from PantryIQ)

### Phase 2: Database Access Layer (Day 1-2)
1. Create `lib/fridayDb.ts` with:
   - `conversationsDB` — fetch, upsert, delete conversations
   - `memoriesDB` — fetch, upsert, delete memories
   - `personalitiesDB` — fetch, upsert personality state
   - `profilesDB` — fetch, upsert user profile
   - All following PantryIQ's error-handling pattern (log, return empty)

2. Create `lib/supabase-types.ts` (mirror PantryIQ's approach):
   - Type definitions for each table
   - Insert/Update types with optional timestamps

### Phase 3: UI: Auth Screens (Day 2)
1. Create `app/auth/login.tsx`:
   - Email/password login form
   - Sign-up link
   - Demo mode option
   - Error display
   - Loading states

2. Create `app/auth/signup.tsx`:
   - Email/password registration
   - Name input field (stored in user_metadata.name)
   - Privacy/ToS acceptance
   - Back to login link

3. Create `app/auth/layout.tsx`:
   - Auth stack before onboarding

### Phase 4: State Management & Sync (Day 2-3)
1. Update `fridayStore.ts`:
   - Add state for `isAuthenticated`, `userId`, `lastSyncTime`
   - Add setters

2. Create `lib/useSupabaseSync.ts`:
   - Listen to `supabase.auth.onAuthStateChange()`
   - On SIGN_IN:
     - Load conversations → populate fridayStore
     - Load memories → populate memory system
     - Load personality → hydrate Friday with warmth/relationship data
     - Update user profile in local AsyncStorage
   - On SIGN_OUT:
     - Clear all Friday data from stores and SQLite
     - Reset to default personality
   - Use `hasSynced` ref to prevent duplicate loads

3. Call hook in root layout (`app/_layout.tsx`)

### Phase 5: Local ↔ Remote Sync (Day 3)
1. **On message send** (in `sendMessage` function):
   - After storing to local SQLite, queue Supabase upsert
   - Don't wait for remote — local takes priority
   - Background sync on next batch

2. **On memory learned**:
   - Upsert to local SQLite first
   - Then upsert to Supabase asynchronously

3. **Conflict resolution**:
   - Latest `updated_at` wins
   - For conversations: no conflicts (append-only)
   - For memories: higher relevance_score wins

### Phase 6: User Settings Integration (Day 3)
1. Update Settings screen:
   - Show "Logged in as: {email}"
   - Add "Sign Out" button (with confirmation)
   - Persist selected model per user in Supabase (optional phase 2)

2. Update Chat screen header:
   - Display user profile name from auth state
   - Show sync status indicator (✓ synced, ⟳ syncing, ✗ offline)

---

## 5. Local Cache + Remote Sync Strategy

### Why SQLite as Primary
- Instant message access (no network latency)
- Works completely offline
- Zustand state for UI reactivity
- Friday context builder uses local data

### Sync Flow: "Local Primary, Remote Backup"
```
User sends message
  ↓
  ├→ Store in local SQLite (IMMEDIATE)
  ├→ Update Zustand store
  ├→ Show in UI
  └→ Queue for Supabase upsert
       ├ Wait 2s for more messages (batch)
       └→ Upsert to Supabase (background, non-blocking)

On app launch / sign-in:
  ├→ Load from SQLite (shows cached data immediately)
  └→ Hydrate from Supabase (if newer)
       └→ Update local SQLite if cloud is newer
```

### Offline Behavior
- Works completely offline (Friday responds from Ollama as normal)
- Stores everything locally in SQLite
- On next network + login: syncs all pending data to Supabase
- No data loss: SQLite is source of truth until synced

---

## 6. Warmth Level & Personality Migration Per User

### Current System (Local Only)
- `interaction_count` stored in SQLite `personality` table
- Warmth calculated by `getWarmthLevel(interaction_count)` in fridayContext.ts
- Resets on app uninstall or when user switches login

### New System (Per-User Cloud)
1. **On sign-in**:
   - Load `friday_personalities` for this user from Supabase
   - Get `interaction_count` (persists across devices/reinstalls)
   - Load all recent memories (up to 10) — context for warmth
   - If first time: create new personality with count=0

2. **Warmth calculation** (unchanged algorithm):
   ```typescript
   function getWarmthLevel(count: number): string {
     if (count === 0) return 'Cool & Professional'
     if (count < 5) return 'Warming Up'
     if (count < 15) return 'Friendly'
     if (count < 30) return 'Warm'
     return 'Very Warm'
   }
   ```

3. **On every message**:
   - Increment local `interaction_count` in memory
   - Save to SQLite immediately
   - Queue Supabase update of personality row
   - Friday's demeanor adapts in real-time

4. **Multi-device consistency**:
   - Supabase is source of truth for `interaction_count`
   - Each device syncs local count on login
   - New device starts with cloud warmth level (no reset)

5. **Memory learning** (unchanged):
   - Extract learnings from each response
   - Store in local SQLite + Supabase `friday_memories`
   - Load 10 recent memories on sync
   - Used to build system prompt context

---

## 7. Implementation Checklist

- [ ] Add `@supabase/supabase-js^2.98.0` to package.json
- [ ] Create `.env.example` with Supabase env var keys
- [ ] Copy `lib/supabase.ts` from PantryIQ
- [ ] Copy `lib/auth.ts` from PantryIQ (no changes needed)
- [ ] Copy `lib/devAuth.ts` from PantryIQ
- [ ] Create `lib/supabase-types.ts` with Friday table types
- [ ] Create `lib/fridayDb.ts` with conversations/memories/personality CRUD
- [ ] Create `app/auth/login.tsx` screen
- [ ] Create `app/auth/signup.tsx` screen
- [ ] Update `app/_layout.tsx` to call `useSupabaseSync()`
- [ ] Update `fridayStore.ts` with auth state
- [ ] Create `lib/useSupabaseSync.ts` hook
- [ ] Update `hooks/useFriday.ts` sendMessage to sync to Supabase
- [ ] Update `app/(tabs)/settings.tsx` with sign-out button
- [ ] Update `app/(tabs)/chat.tsx` with sync status indicator
- [ ] Test auth flow (signup → login → message → sync)
- [ ] Test offline mode (message offline, sync on reconnect)
- [ ] Test multi-device (login on device 2, verify warmth carries over)
- [ ] Test personality persistence (check interaction_count survives logout/login)

---

## 8. File Structure After Implementation

```
FridayMobile/
├── lib/
│   ├── supabase.ts              ← COPY from PantryIQ
│   ├── auth.ts                  ← COPY from PantryIQ
│   ├── devAuth.ts               ← COPY from PantryIQ
│   ├── supabase-types.ts        ← NEW: Friday table types
│   ├── fridayDb.ts              ← NEW: Friday CRUD operations
│   ├── useSupabaseSync.ts       ← NEW: Auth state → data sync
│   ├── friday/
│   │   ├── fridayMemory.ts      ← (unchanged, but synced to Supabase)
│   │   ├── fridayContext.ts     ← (unchanged)
│   │   ├── fridayStore.ts       ← UPDATE: add auth state
│   │   └── types.ts             ← (unchanged)
│   └── ...
├── app/
│   ├── _layout.tsx              ← UPDATE: call useSupabaseSync()
│   ├── auth/
│   │   ├── _layout.tsx          ← NEW: auth stack
│   │   ├── login.tsx            ← NEW: login screen
│   │   └── signup.tsx           ← NEW: signup screen
│   ├── (tabs)/
│   │   ├── chat.tsx             ← UPDATE: sync indicator
│   │   ├── settings.tsx         ← UPDATE: sign-out button
│   │   └── ...
│   └── ...
├── constants/
│   └── onboarding.ts            ← (unchanged)
├── .env                         ← UPDATE: add Supabase keys
└── package.json                 ← UPDATE: add @supabase/supabase-js
```

---

## 9. Edge Cases & Considerations

### Scenario: User switches accounts
- Sign out clears all Friday data from stores and SQLite
- Sign in with different user loads that user's data
- Old user's data remains on disk but is not loaded
- Data is segregated by user_id in Supabase

### Scenario: User offline, sends 10 messages, reconnects
- All 10 stored locally in SQLite
- On reconnect, background sync batches them to Supabase
- No data loss

### Scenario: Friday data on device A gets ahead of device B
- Device A: 20 messages, warmth=10
- Device B: 15 messages, warmth=9
- On sync: both devices get latest count from Supabase
- No conflict: append-only conversations log

### Scenario: User's Ollama endpoint changes
- Stored in Supabase `friday_user_profiles.ollama_endpoint` (optional)
- Or: keep as device-specific setting in AsyncStorage (no sync needed)
- Decide based on multi-device use case

### Scenario: Dev mode auto-login
- `tryAutoLoginDev()` called in `_layout.tsx`
- Signs in with `EXPO_PUBLIC_TEST_EMAIL` / `EXPO_PUBLIC_TEST_PASSWORD`
- Allows testing full auth flow without manual login

---

## 10. Success Criteria

✅ User can sign up with email → Friday remembers them on login
✅ User can log out → data is cleared, can log in as different user
✅ Conversations persist across app restarts and device reinstalls
✅ Warmth level persists per user (doesn't reset on logout)
✅ Memories are learned and retrieved per user
✅ App works 100% offline (no network dependency)
✅ Multi-user: Different users have isolated chat history
✅ Performance: Message send <100ms (local SQLite first)
✅ Sync: Supabase updates background, never blocks UI

---

## 11. Open Questions (For Implementation Phase)

1. **Model selection per user**: Store `selected_model` in Supabase?
2. **Voice settings per user**: Store voice engine preference in cloud?
3. **Auto-sync strategy**: Immediate vs batch (every N messages)?
4. **Conflict resolution**: If user edits old message on device A while device B syncs — how to handle?
5. **Data retention**: When user deletes account, cascade delete all Friday data?
6. **Analytics**: Track anonymized interaction patterns for model improvement?
7. **Export**: Allow users to export their conversation history?

---

## 12. Dependencies to Add

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.98.0"
  }
}
```

No other dependencies needed — reusing existing Expo modules and AsyncStorage.

---

**Status**: Ready for implementation. All files identified. No blocking dependencies.
