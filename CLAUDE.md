# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

F.R.I.D.A.Y. — an Iron Man–style AI assistant for iOS/Android built with Expo (SDK 54) / React Native 0.81 / TypeScript (strict). The app is a chat + voice client that talks to a self-hosted home server ("KNIGHTSWATCH") for LLM inference, TTS, memory, and image generation, with Supabase for auth and per-user persistence, and cloud fallbacks when the home server is unreachable.

## Commands

```bash
npm install            # install dependencies
npm start              # expo start (dev server, port 8081)
npm run ios            # expo run:ios (native build)
npm run android        # expo run:android (native build)
npm run web            # expo start --web
npm run lint           # expo lint (eslint-config-expo flat config)
npx tsc --noEmit       # typecheck (strict mode)
```

There is no test suite or test runner configured.

- **Expo Go vs dev build**: voice input (`expo-speech-recognition`, `@react-native-voice/voice`) requires native modules — run `expo prebuild` + `expo run:ios|android` or an EAS build. In Expo Go, `services/voiceInput.ts` gracefully degrades to text-only.
- **EAS builds**: profiles in `eas.json` (`development` = dev client, `preview` = internal, `production` = store). Project ID and app config live in `app.json`.
- Icons are generated with `node scripts/generate-icons.js` (requires `sharp`, reads a 1024x1024 `app-icon.png`; spec in `ICON_SPECIFICATION.md`).

## Architecture

### Three backend tiers

1. **KNIGHTSWATCH home server** (primary) — all connections go through `services/knightswatch.ts`, the connection manager that probes the local LAN IP first, falls back to Tailscale IP, caches the working route, and re-checks on failure. **Never hardcode server IPs elsewhere** — always use its URL builders:
   - `ollamaUrl()` — Ollama LLM API (port 11434)
   - `ttsUrl()` — local TTS service (port 8082)
   - `memoryUrl()` — memory save/recall service (port 8081)
   - `comfyuiUrl()` — ComfyUI/Flux image generation (port 8188)
   - `getActiveIp()` + port 8765 — desktop bridge used by `services/api.ts` (LLM/run/file endpoints) and `services/shipComputer/*` (Mac control: screen vision, app control, workflow engine)
2. **Supabase** (auth + persistent per-user data) — client in `lib/supabase.ts` (shared project with the PantryIQ app; env vars `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` with embedded public fallbacks). Tables/RLS/RPCs are created by running `schema.sql` in the Supabase SQL editor (extra migrations in `lib/supabase-migrations.sql`).
3. **Cloud fallbacks** — ElevenLabs TTS (`services/voice.ts` tries local TTS first, then ElevenLabs, config in `constants/elevenlabs.ts`), DuckDuckGo instant answers (`services/webSearch.ts`), and `services/tools.ts` answers trivial date/time/math queries locally without any network call.

Graceful degradation is a core convention: `services/serviceChain.ts` runs primary → fallback → local tiers and never crashes; most service functions catch errors and return empty/null rather than throwing.

### Routing and auth flow (expo-router, file-based)

- `app/_layout.tsx` — root layout: Supabase session listener, auth-guard redirects (unauthenticated → `/auth/login`), deep-link handling for email verification (`fridaymobile://auth/callback`), first-launch onboarding check (profile in AsyncStorage).
- `app/index.tsx` → redirects to `/(tabs)/chat`.
- `app/(tabs)/_layout.tsx` — **custom** tab UI (not standard expo-router tabs): renders `BottomNavigationBar`, `NavigationDrawer` (session history), and hosts the chat screen; owns session list state and the selected Ollama model.
- `app/auth/` — login/signup/verify screens backed by `lib/auth.ts`.
- Typed routes are enabled (`experiments.typedRoutes`), as is the React Compiler and New Architecture.

### State and data layers

- **In-flight chat state**: Zustand store at `lib/friday/fridayStore.ts` (messages only).
- **`hooks/useFriday.ts`** is the orchestration hub for chat: builds the dynamic system prompt (`lib/friday/fridayContext.ts` — personality + typed memories + active tasks + user context + reasoning mode), recalls relevant memories, sends to Ollama, extracts learnings from responses, and tracks usage.
- **Three persistence layers, by scope**:
  - Supabase (`lib/friday-db.ts`, `lib/conversationService.ts`) — per-user conversations, sessions, memories, personality, profile (cloud, multi-user).
  - Local SQLite (`lib/friday/fridayMemory.ts`) — on-device typed memory store (`user`/`feedback`/`project`/`reference` types).
  - AsyncStorage (`services/fridayHistory.ts`, `constants/onboarding.ts`) — conversation session history and user profile (name/timezone).
  - KNIGHTSWATCH memory service (`services/memory.ts`) — server-side memory save/recall via Ollama side-queries.
- **Background work**: `services/taskManager.ts` (typed, killable tasks) and `services/dreamService.ts` (4-phase memory consolidation: orient → gather → consolidate → prune). `services/contextCache.ts` provides TTL caching; `services/usageTracker.ts` counts per-session requests.

### Naming gotchas

- Two files named `fridayContext.ts` exist: `lib/friday/fridayContext.ts` (system prompt builder) and `services/fridayContext.ts` (project/git context injection via the desktop bridge). Check imports carefully.
- `lib/` = data access + Friday core (Supabase, auth, SQLite, prompt building); `services/` = network services (KNIGHTSWATCH, voice, search, images, ship computer).

## Conventions

- Path alias `@/*` maps to the repo root (see `tsconfig.json`); imports use it throughout.
- TypeScript strict mode; fix type errors rather than suppressing them.
- Services follow a module-with-functions or singleton-class pattern with listener/subscribe APIs (`addConnectionListener`, task listeners) rather than React context.
- DB access wrappers log errors with a `[functionName]` prefix and return safe defaults (`[]`, `null`) instead of throwing.
- Dark theme only (`userInterfaceStyle: "dark"`, background `#0A0A0F`, primary `#00D4FF`); theme values in `constants/theme.ts`.
- `.env` holds `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `ELEVENLABS_API_KEY`. Only `EXPO_PUBLIC_`-prefixed vars are available in app code.

## Reference docs in repo

- `FRIDAY_AUTH_PLAN.md` — auth architecture and Supabase table design rationale.
- `NEXT_STEPS.md` — setup checklist (Supabase tables, env config, icon generation, auth testing).
- `IMPLEMENTATION_SUMMARY.md` — voice input/onboarding/profile implementation details and Expo Go limitations.
- `schema.sql` — canonical Supabase schema (run manually in SQL editor; not auto-migrated).
