# Progressive Web App (v1) — Specification

**Status:** Specified (2026-11-06) · **Owner:** Dev B (frontend) · **Depends on:** PR #5 (signed Hone tokens), frontend CI (`level-up` stream A1)
**Design:** [design.md](./design.md) · **Tasks:** [tasks.md](./tasks.md) · **Context:** [ANALYSIS-2026-11-06.md §5](../../project/ANALYSIS-2026-11-06.md)

## Problem Statement

Hone is practiced in short, repeated sessions — the kind of habit that lives on a phone home screen. Today it is a browser tab only: no install, no app icon, no standalone window, and a blank error page when the network drops. Candidates who want to review their feedback or study backlog on the train cannot, even though that data was already loaded.

## Goals

- [ ] Hone is **installable** on Android Chrome, desktop Chrome/Edge, and iOS/iPadOS Safari (Add to Home Screen), opening standalone at `/dashboard`
- [ ] The installed app looks native: Hone icon (incl. maskable), white theme bar, safe-area aware layout, no browser chrome
- [ ] **Offline, the app opens** to its shell instead of a browser error, and shows already-loaded **read-only history**: practice sessions + messages, feedback, study backlog (review items), weak answers, study session results
- [ ] Offline, every action that needs the API (start practice/study, send turn, mic, upload, delete, apply) is **disabled with clear copy**, never a silent failure
- [ ] Interviews behave **identically** with the service worker active: SSE tokens stream unbuffered, STT uploads work, auth sign-in/out works
- [ ] New deploys reach users via an **update prompt**, never a reload in the middle of an interview
- [ ] Install funnel is measurable in PostHog
- [ ] Hone's PWA **does not affect other apps** on the shared `labs.borderlesscoding.com` origin (Career Forge at `/career-forge`, etc.)

## Out of Scope (v1)

| Item | Reason |
| ---- | ------ |
| Web Push notifications ("feedback ready", "quota refilled") | v2 — needs backend notifications module, VAPID keys, subscription table; decided 2026-11-06 |
| Offline interviews / queued turns | Interviews are a live LLM conversation; a queued answer has no interviewer |
| Offline writes (background sync of deletes, status changes) | Conflict handling cost > value; read-only offline is the v1 bar |
| Caching resume files (`GET /api/resumes/:id/file`) | Raw PII binary; owner-only endpoint must stay network-only (AD-021) |
| App-store packaging (TWA / Capacitor) | PWA first; revisit when install data exists |
| Share target (open PDF from OS share sheet) | v2 candidate |
| Dark mode / theme-color per scheme | App is forced light (`providers.tsx`) |
| Changing auth storage (localStorage → httpOnly cookie) | Separate concern (CONCERNS.md); PWA works with current storage |

## Relationship to Existing Features

| Feature / code | Relevance |
| -------------- | --------- |
| PR #5 / AD-025 signed Hone token | Offline shell must not treat "offline" as "401" (would sign the user out) |
| `AuthGuard` (client-only) | Offline open with a stored session must render the shell, not redirect to `/login` |
| `fetchWithAuth` 401 → sign out | Network errors (`TypeError: Failed to fetch`) MUST NOT trigger sign-out |
| `sse-stream.ts` / interview + review streams | SW MUST NOT intercept; streams are cross-origin (Railway) |
| `use-audio-recorder.ts` (MediaRecorder) | Must work in iOS standalone (`audio/mp4`) — backend accepts any `audio/*` |
| quick task 006 (persisted practice turns) | Basis for "connection lost → resume" behaviour |
| `queryClient` (TanStack Query) | Persisted to IndexedDB for offline history |
| PostHog provider | Install funnel events + `display_mode` super property |
| Landing (`/`) | Public, not part of the installed app scope's start screen |

---

## Decisions

| ID | Decision |
| -- | -------- |
| PWA-DEC-01 | v1 scope = **installable + offline read-only history**. Push is v2. (Yuri, 2026-11-06) |
| PWA-DEC-02 | `start_url` = `${basePath}/dashboard`; `id` = `${basePath}/`; `scope` = `${basePath}/`. (Yuri, 2026-11-06) |
| PWA-DEC-03 | **Hand-written service worker** (`public/sw.js`), no Serwist/next-pwa — Next 16 builds with Turbopack; OpenNext serves `public/` from the `ASSETS` binding |
| PWA-DEC-04 | SW handles **same-origin GET only**. Cross-origin (Railway API), `/api/auth/*`, non-GET, and `text/event-stream` are never intercepted |
| PWA-DEC-05 | All Cache Storage names, IndexedDB names and localStorage keys are prefixed `hone-`; activate-cleanup deletes **only** `hone-*` caches (shared origin) |
| PWA-DEC-06 | SW registration scope is `${basePath}/` — never `/` — so Career Forge and other Labs apps are unaffected |
| PWA-DEC-07 | Offline history = persisted TanStack Query cache (IndexedDB, `maxAge` 7 days, **cleared on logout**). Resume file bytes and raw resume text are excluded |
| PWA-DEC-08 | Updates: new SW waits; UI shows "New version available — Reload". `skipWaiting` only on click, and the prompt is suppressed while an interview/review stream is active |
| PWA-DEC-09 | Network failure ≠ auth failure: only an HTTP 401 response signs out |
| PWA-DEC-10 | Install UX: Chromium `beforeinstallprompt` → "Install app" in sidebar + dashboard card; iOS → one-time dismissible "Share → Add to Home Screen" hint; never on landing/login |
| PWA-DEC-11 | No new runtime dependency for the SW; `@tanstack/react-query-persist-client` + `idb-keyval` are the only additions |

---

## Requirements

### Installability

| ID | Requirement |
| -- | ----------- |
| PWA-01 | `app/manifest.ts` serves a valid manifest at `${basePath}/manifest.webmanifest` with name "Hone — AI Mock Interview", short_name "Hone", `display: standalone`, `background_color`/`theme_color` `#ffffff`, `start_url`/`scope`/`id` per PWA-DEC-02 |
| PWA-02 | Icons: 192×192 and 512×512 `any`, 512×512 `maskable` (80% safe zone), existing `apple-icon.png` (180×180). All paths include basePath |
| PWA-03 | Manifest `shortcuts`: "New practice" → `/practice/new`, "Study" → `/study` |
| PWA-04 | Root layout exports `viewport` with `themeColor: "#ffffff"`, `viewportFit: "cover"`; `metadata.appleWebApp = { capable: true, title: "Hone", statusBarStyle: "default" }`; `<html lang="en">`; title "Hone" |
| PWA-05 | Mobile top bar, sidebar drawer and chat composers respect `env(safe-area-inset-*)` in standalone mode |
| PWA-06 | Chrome DevTools → Application → Manifest reports installable with zero warnings, locally (no basePath) and on Labs (basePath) |

### Service worker

| ID | Requirement |
| -- | ----------- |
| PWA-10 | SW registered from a client component after `load`, at `${basePath}/sw.js` with scope `${basePath}/`; not registered in `next dev` unless `NEXT_PUBLIC_ENABLE_SW_DEV=true` |
| PWA-11 | Precache on install: offline page, icons, manifest. Versioned cache name `hone-shell-<build id>` |
| PWA-12 | `/_next/static/*`, fonts, icons → cache-first in `hone-static` (immutable hashed assets) |
| PWA-13 | Navigations inside scope → network-first (3 s timeout) → cached page → `/offline` |
| PWA-14 | Never intercepted: cross-origin requests, `/api/auth/*`, non-GET, `Accept: text/event-stream`, `/sw.js`, `/manifest.webmanifest` |
| PWA-15 | `public/_headers`: `/sw.js` → `Cache-Control: no-cache`; `/manifest.webmanifest` → `Cache-Control: public, max-age=3600` |
| PWA-16 | On activate, delete caches matching `^hone-` that are not current; never touch other caches |

### Offline experience

| ID | Requirement |
| -- | ----------- |
| PWA-20 | `/offline` route: Hone branding, "You're offline", "Interviews need a connection", link to Dashboard |
| PWA-21 | `useNetworkStatus()` hook (`navigator.onLine` + `online`/`offline` events); global offline banner in `AppShell` |
| PWA-22 | Offline: Start practice, Start study, send turn, mic, resume upload, delete, apply/priority changes are disabled with tooltip/inline copy "Available when you're back online" |
| PWA-23 | TanStack Query persisted to IndexedDB (`hone-query-cache`), `maxAge` 7 days, `buster` = build id; persisted query-key roots allow-list: `interview` (sessions, messages, feedback), `review-items`, `review-sessions`, `weak-answers`. Excluded: `resumes` (structured summary is PII and re-fetchable), `session-quota` (stale quota would lie) |
| PWA-24 | Logout and 401 sign-out clear the persisted cache and `hone-*` runtime caches |
| PWA-25 | Offline open with a stored session renders the shell + cached data; `AuthGuard` does not redirect on network errors |
| PWA-26 | Query `networkMode: "offlineFirst"` for persisted reads; mutations stay `online` |

### Interview resilience

| ID | Requirement |
| -- | ----------- |
| PWA-30 | With SW active, SSE time-to-first-token and token cadence match SW-disabled baseline (manual + Playwright check) |
| PWA-31 | If the stream drops (offline or tab backgrounded), chat shows "Connection lost" + **Resume** (re-fetch persisted turns, continue) instead of an infinite spinner |
| PWA-32 | Mic/STT works in iOS standalone and Android standalone |

### Updates & analytics

| ID | Requirement |
| -- | ----------- |
| PWA-40 | When a new SW is waiting, show a non-blocking toast "New version available" + **Reload**; hidden while a stream is active (PWA-DEC-08) |
| PWA-41 | PostHog events: `pwa_install_prompt_shown`, `pwa_install_accepted`, `pwa_install_dismissed`, `pwa_ios_hint_shown`, `pwa_installed` (`appinstalled`), `pwa_update_applied`; super property `display_mode` (`standalone` \| `browser`) |

---

## Acceptance (UAT)

1. Android Chrome: install from sidebar button → icon on home screen → opens standalone at `/dashboard`.
2. iOS Safari: hint shown once → Add to Home Screen → standalone at `/dashboard`; sign in once (separate storage — expected).
3. Desktop Chrome: install icon in omnibox → standalone window.
4. Complete a full practice interview **with mic** in standalone on iOS and Android.
5. Airplane mode → open app → dashboard, practice history, feedback and study backlog visible; start buttons disabled with copy; no sign-out.
6. Kill network mid-interview → "Connection lost" + Resume works when back online.
7. Deploy a new build → "New version available" appears on next navigation (not mid-stream) → Reload → new version.
8. Open `labs.borderlesscoding.com/career-forge` in the same browser → no Hone SW controls it; Career Forge works unchanged.
9. Logout → IndexedDB `hone-query-cache` and `hone-*` caches are empty.
