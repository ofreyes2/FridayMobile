# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

F.R.I.D.A.Y. is an Expo/React Native (TypeScript, strict mode) personal AI assistant app — "Iron Man FRIDAY in your pocket." It talks to a self-hosted backend ("KNIGHTSWATCH") for LLM inference, TTS, memory, and image generation, and uses Supabase for auth and cloud persistence.

## Commands

```bash
npm start              # Expo dev server (Expo Go or dev client)
npm run ios            # expo run:ios (native build)
npm run android        # expo run:android
npm run web            # expo start --web
npm run lint           # expo lint (ESLint flat config, eslint-config-expo)
npx tsc --noEmit       # typecheck (strict mode)
```

There is no test framework configured. Verification is `npx tsc --noEmit` + `npm run lint` + manual testing.

Native-module features (voice input via `expo-speech-recognition` / `@react-native-voice/voice`, SQLite) require a dev client build (`expo prebuild` / `expo run:ios`). In Expo Go these gracefully degrade — e.g. `services/voiceInput.ts` falls back to text-only mode. EAS build profiles are in `eas.json` (development/preview/production).

## Environment

`.env` provides `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and an ElevenLabs key. `lib/supabase.ts` has hardcoded fallback values (public anon key) so EAS builds work without env injection. The Supabase project is shared with another app (PantryIQ). `schema.sql` must be executed in the Supabase SQL editor to create tables, RLS policies, and RPC functions (see `NEXT_STEPS.md`).

## Architecture

### Two backends

1. **KNIGHTSWATCH** (self-hosted Mac server) — all realtime AI features. `services/knightswatch.ts` is the single connection manager: it probes the local-network IP first, falls back to the Tailscale IP, caches the working one, and exposes URL helpers for each service port (Ollama `:11434`, memory `:8081`, TTS `:8082`, ComfyUI `:8188`; `services/api.ts` uses a command/file server on `:8765`). **Never hardcode server IPs anywhere else** — always go through `knightswatch.ts` (`getActiveIp()`, `ollamaUrl()`, `memoryUrl()`, etc.). iOS ATS exceptions for these IPs live in `app.json`.

2. **Supabase** — auth (email/password with deep-link verification via `fridaymobile://auth/callback`), plus cloud persistence of conversations, memories, personality, and user profiles. Data access goes through `lib/friday-db.ts` (typed CRUD wrappers over the `friday_*` tables defined in `schema.sql`) and `lib/conversationService.ts` (chat sessions). `lib/auth.ts` wraps auth operations.

### Routing (expo-router, file-based)

- `app/_layout.tsx` — root: Supabase session state, auth-based redirects, and deep-link handling for email verification.
- `app/index.tsx` → redirects to `/(tabs)/chat`.
- `app/auth/` — login, signup, verify screens.
- `app/(tabs)/_layout.tsx` — **not** an expo-router `<Tabs>`; it's a custom container that owns the active tab state (home/discover/library), the navigation drawer, session list, and model selection, and renders `chat.tsx` (the main screen, ~2700 lines) directly as a component. `editor.tsx`, `files.tsx`, `run.tsx`, `settings.tsx` are additional routes backed by the `:8765` API.

### The Friday "brain"

`hooks/useFriday.ts` is the orchestration hub for chat. It composes:

- `lib/friday/fridayStore.ts` — Zustand message store.
- `lib/friday/fridayContext.ts` — builds the dynamic system prompt (personality, typed memories, active tasks, user settings) and extracts learnings from responses.
- `lib/friday/fridayMemory.ts` + `services/memory.ts` — typed memories with relevant-memory recall (an Ollama side-query picks which memories matter for the current message).
- `services/taskManager.ts`, `services/usageTracker.ts`, `services/contextCache.ts` — tasks, token/usage tracking, context caching.

### Service patterns

- **Graceful degradation everywhere**: `services/serviceChain.ts` runs a chain of tiers (primary → fallback → local) and returns the first success with tier info — never crash on a dead backend. Same philosophy in individual services: TTS tries local KNIGHTSWATCH then ElevenLabs (`services/voice.ts`, `constants/elevenlabs.ts`); DB wrappers in `lib/friday-db.ts` log errors and return empty results rather than throwing.
- `services/connectionStatus.ts` surfaces the current connection method (Local Network / Tailscale / Disconnected) in the UI.
- `services/shipComputer/` — the "Ship Computer" Mac-control layer: screen vision, app control, workflow engine, context awareness, and an intent parser (`parseAndExecute`, `looksLikeCommand`) that routes natural-language commands to it. Barrel-exported from `services/shipComputer/index.ts`.
- `services/ollamaModels.ts` fetches available models; `services/comfyui.ts` handles image generation; `services/webSearch.ts`, `services/dreamService.ts` cover search and background "dreams."

## Conventions

- Import alias `@/*` maps to the repo root (`tsconfig.json`).
- TypeScript strict mode; keep `npx tsc --noEmit` clean.
- Dark theme only (`userInterfaceStyle: "dark"`): background `#0A0A0F`, primary accent `#00D4FF` (see `constants/theme.ts`).
- Services log with a `[serviceName.method]` prefix and fail soft (return defaults) instead of throwing to the UI.
- Chat state lives in Zustand (`fridayStore`); lightweight device-local prefs (onboarding profile, toggles) live in AsyncStorage.

## Reference docs in repo

- `FRIDAY_AUTH_PLAN.md` — auth system design.
- `IMPLEMENTATION_SUMMARY.md` — voice conversation & user profile implementation details.
- `NEXT_STEPS.md` — Supabase setup and testing checklist.
- `schema.sql` — canonical Supabase schema (tables, indexes, RLS, RPC).
- `ICON_SPECIFICATION.md` + `scripts/generate-icons.js` — app icon generation (requires `sharp`).
