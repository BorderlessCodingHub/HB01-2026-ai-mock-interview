# Progressive Web App (v1) — Design

**Spec:** [spec.md](./spec.md) · **Tasks:** [tasks.md](./tasks.md)

## 1. Runtime topology

```
labs.borderlesscoding.com  (shared origin — Career Forge, other Labs apps)
└── /ai-mock-interview/            ← Hone scope (SW + manifest live here)
    ├── manifest.webmanifest       Next metadata route (app/manifest.ts)
    ├── sw.js                      public/ → OpenNext ASSETS binding
    ├── /_next/static/*            cache-first (hone-static)
    ├── /dashboard, /practice…     network-first → cache → /offline
    └── /api/auth/*                NEVER intercepted (better-auth on the Worker)

hone-…up.railway.app (cross-origin)  ← REST + SSE + STT — NEVER intercepted
```

Key consequence of the shared origin: Cache Storage, IndexedDB and localStorage are **shared with every app on labs.borderlesscoding.com**. Everything Hone creates is prefixed `hone-`, and cleanup only touches `hone-*` (PWA-DEC-05). The SW scope `/ai-mock-interview/` guarantees it never controls Career Forge pages (PWA-DEC-06).

## 2. Files

| File | Kind | Purpose |
| ---- | ---- | ------- |
| `src/app/manifest.ts` | new | Metadata route; reads `process.env.NEXT_BASE_PATH ?? ""` at build |
| `public/icons/icon-192.png`, `icon-512.png`, `maskable-512.png` | new | Generated from `src/assets/logo.png` (maskable: logo at 60% on `#ffffff`) |
| `public/sw.js` | new | Service worker source with `__HONE_BUILD_ID__` placeholder |
| `scripts/stamp-sw.mjs` | new | Post-build: replaces placeholder with `.next/BUILD_ID` in the emitted asset (`.open-next/assets/sw.js` for Cloudflare, `public` copy untouched) |
| `public/_headers` | edit | `no-cache` for `/sw.js`, 1h for manifest (paths with basePath — see §6) |
| `src/app/layout.tsx` | edit | `viewport`, `appleWebApp`, `lang="en"`, title |
| `src/app/offline/page.tsx` | new | Static offline page (precached) |
| `src/features/pwa/register-sw.tsx` | new | Client component: registration, update detection, toast |
| `src/features/pwa/use-network-status.ts` | new | `online`/`offline` hook |
| `src/features/pwa/offline-banner.tsx` | new | Banner rendered in `AppShell` |
| `src/features/pwa/use-install-prompt.ts` | new | `beforeinstallprompt` capture, iOS detection, dismissal memory (`hone-pwa-install-dismissed`) |
| `src/features/pwa/install-app-button.tsx` | new | Sidebar item + dashboard card |
| `src/features/pwa/stream-activity.ts` | new | Tiny store: `markStreamActive(true/false)` used by chats; read by update toast |
| `src/lib/query-client.ts` | edit | `persistQueryClient` with `idb-keyval` storage, allow-list, `maxAge`, `buster` |
| `src/features/auth/session-provider.tsx` | edit | Logout / 401 → `clearHoneOfflineData()` |
| `src/features/interview/interview-chat.tsx`, `src/features/study/review-session-chat.tsx` | edit | Disabled-offline states; "Connection lost → Resume"; stream-activity marks |

## 3. Service worker (`public/sw.js`)

```js
const BUILD = "__HONE_BUILD_ID__";
const SCOPE = new URL(self.registration.scope).pathname;        // "/ai-mock-interview/" or "/"
const SHELL = `hone-shell-${BUILD}`;
const STATIC = "hone-static";
const PAGES = `hone-pages-${BUILD}`;
const PRECACHE = ["offline", "icons/icon-192.png", "icons/icon-512.png", "manifest.webmanifest"]
  .map((p) => SCOPE + p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
  // no skipWaiting here — PWA-DEC-08
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, STATIC, PAGES]);
    for (const k of await caches.keys())
      if (k.startsWith("hone-") && !keep.has(k)) await caches.delete(k);   // PWA-16
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "HONE_SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;                                   // PWA-14
  if (url.origin !== self.location.origin) return;                    // Railway API and any third-party origin
  if (!url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.startsWith(`${SCOPE}api/`)) return;                // better-auth
  if (req.headers.get("accept")?.includes("text/event-stream")) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (url.pathname.startsWith(`${SCOPE}_next/static/`) || url.pathname.startsWith(`${SCOPE}icons/`)) {
    e.respondWith(cacheFirst(req, STATIC));                           // PWA-12
  } else if (req.mode === "navigate") {
    e.respondWith(networkFirst(req, PAGES, 3000));                    // PWA-13
  }
});
```

`networkFirst` races `fetch` against a 3 s timeout; on success it `put`s a clone into `PAGES` (only `res.ok && res.type === "basic"`); on failure it returns the cached page or `caches.match(SCOPE + "offline")`.

Why not cache RSC payloads (`?_rsc=` fetches during client navigation)? The `(app)` routes are client components fed by TanStack Query; once the shell JS is cached, client-side navigation renders from persisted query data. An RSC fetch that fails offline falls back to a hard navigation, which `networkFirst` then serves from cache or `/offline`. Keep v1 simple; revisit only if UAT shows broken client navigations offline.

## 4. Offline data — TanStack Query persistence

```ts
// lib/query-client.ts (sketch)
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";

const store = createStore("hone-query-cache", "queries");
// Roots of lib/query/keys.ts. Practice sessions + messages + feedback live under "interview".
// "resumes" and "session-quota" are deliberately NOT persisted (PWA-DEC-07, PWA-23).
export const PERSISTED_ROOTS = new Set(["interview", "review-items", "review-sessions", "weak-answers"]);
// Unit test: every root here exists in queryKeys, and "resumes"/"session-quota" are absent.

persistQueryClient({
  queryClient,
  persister: createAsyncStoragePersister({
    storage: { getItem: (k) => get(k, store), setItem: (k, v) => set(k, v, store), removeItem: (k) => del(k, store) },
    key: "hone-rq",
    throttleTime: 2000,
  }),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: process.env.NEXT_PUBLIC_BUILD_ID,
  dehydrateOptions: {
    shouldDehydrateQuery: (q) => q.state.status === "success" && PERSISTED_ROOTS.has(String(q.queryKey[0])),
  },
});
```

- `gcTime` for persisted roots raised to ≥ `maxAge` (otherwise GC drops them before persistence matters).
- Persist is started **only when a session exists** and torn down on logout; `clearHoneOfflineData()` = `queryClient.clear()` + `del("hone-rq", store)` + delete `hone-pages-*` caches (pages may contain user names).
- Shared-device risk: 7-day `maxAge` + clear on logout + no resume bytes/raw text is the agreed mitigation (PWA-DEC-07).

## 5. Online/offline & auth interplay

```
fetch() rejects (TypeError)  → network error  → keep session, show offline banner, query stays cached
HTTP 401                     → auth error     → existing sign-out path (+ clearHoneOfflineData)
HTTP 5xx / 429               → unchanged toasts
```

`fetchWithAuth` already signs out only on `ApiError` with status 401; a regression unit test pins this (PWA-DEC-09). The global `QueryCache.onError` toast is suppressed when `!navigator.onLine` to avoid a toast storm offline.

### Stream drop → Resume

`readSseStream` already throws on abort/close. Chats catch non-abort failures while `!navigator.onLine` **or** `document.visibilityState` changed during the stream, and render a `ConnectionLostNotice` with **Resume**: invalidate the session messages query (persisted turns, quick task 006) and re-enter the normal "continue session" path. No backend change.

## 6. basePath & Cloudflare details

- `NEXT_BASE_PATH=/ai-mock-interview` only in `build:cloudflare`; local dev has no basePath — every path is built from `process.env.NEXT_BASE_PATH ?? ""` (manifest, registration) or from `registration.scope` (SW). No hard-coded `/ai-mock-interview` outside `_headers`.
- `public/_headers` paths are matched against the **request** path, which includes the basePath on Labs:
  ```
  /ai-mock-interview/sw.js
    Cache-Control: no-cache
  /ai-mock-interview/manifest.webmanifest
    Cache-Control: public, max-age=3600
  ```
  Verify in `scripts/verify-cloudflare-basepath.mjs` that `sw.js` exists in `.open-next/assets/ai-mock-interview/` (or wherever OpenNext emits basePath assets) and is stamped (no `__HONE_BUILD_ID__` left).
- `run_worker_first: true` means the Worker sees asset requests first; confirm OpenNext passes `sw.js` through as a static asset (spike T1).
- `Service-Worker-Allowed` header is **not** needed: the SW sits at the root of its scope.

## 7. Install UX

| Platform | Signal | UI |
| -------- | ------ | -- |
| Chromium (Android/desktop) | `beforeinstallprompt` captured & deferred | Sidebar "Install app" item + dismissible dashboard card → `prompt()` |
| iOS/iPadOS Safari | UA is iOS **and** `!navigator.standalone` | One-time dismissible card: "Install Hone: tap Share → Add to Home Screen" |
| Already installed | `matchMedia("(display-mode: standalone)")` or `navigator.standalone` | Nothing shown |
| Landing `/`, `/login` | — | Never shown |

Dismissal stored in `localStorage["hone-pwa-install-dismissed"]` (timestamp; re-show after 30 days).

## 8. Testing strategy

| Layer | What |
| ----- | ---- |
| Unit (vitest — requires stream A1) | `use-network-status`, `use-install-prompt` (iOS/Chromium/standalone matrix), persisted-roots ⊆ query key roots, 401-vs-network sign-out regression, `stamp-sw` replaces placeholder |
| SW logic | Extract route classification into a pure `classifyRequest(url, method, accept, scope)` in `public/sw-routes.js`, imported by `sw.js` via `importScripts`; unit-test the classifier |
| Playwright (stream A3) | manifest served & parsable; SW registers with scope `/`; `context.setOffline(true)` → reload → dashboard renders cached sessions; start button disabled; SSE interview still streams with SW active |
| Manual UAT | spec §Acceptance on real Android + iPhone, plus the Career Forge non-interference check |

## 9. Risks

| Risk | Mitigation |
| ---- | ---------- |
| OpenNext/Workers serving `sw.js` with wrong headers or through the worker | Spike T1 before building on it |
| Stale shell after deploy pins users to old JS calling a newer API | Update toast + `buster` on query cache; API stays backward-compatible one release (team rule) |
| iOS evicts PWA storage after ~7 days without use | Acceptable: cache is a convenience; app works online |
| SW bug breaks the whole app | Kill switch: deploy `sw.js` that `unregister()`s itself + clears `hone-*` caches (`public/sw-kill.js` kept in repo, documented in runbook) |
| Shared-origin collision | `hone-` prefixes + scoped registration + UAT step 8 |
