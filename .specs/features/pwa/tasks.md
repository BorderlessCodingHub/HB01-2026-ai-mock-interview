# Progressive Web App (v1) — Tasks

**Spec:** [spec.md](./spec.md) · **Design:** [design.md](./design.md)
**Owner:** Dev B · **Status:** Specified (2026-11-06) · **Linear:** project Hone, label Type/feature

Each task = one Linear issue = one branch = one PR (≤ ~400 LOC). `[P]` = can run in parallel with siblings in the same phase.

**Gate before Phase 2:** stream A1 (frontend CI with vitest) merged — PWA tasks add unit tests.

---

## Execution Plan

```
Phase 1  T1 spike ──→ T2 [P] manifest+icons+meta
                      T3 [P] safe-area layout
Phase 2  T2 ──→ T4 SW core (register, precache, static, navigation, /offline, headers, stamp)
Phase 3  T4 ──→ T5 [P] install UX + analytics
               T6 [P] network status + offline banner + disabled actions
               T7 [P] query persistence + logout clear
Phase 4  T4,T6 ──→ T8 update toast + stream-activity guard
         T6 ──→ T9 connection lost → Resume
Phase 5  T5–T9 ──→ T10 Playwright PWA checks + device UAT + kill-switch runbook
```

---

## Phase 1 — Foundation

### T1 · [LABS01-174](https://linear.app/borderless-coding/issue/LABS01-174) — Spike: SW + manifest on OpenNext/Workers with basePath  `S` · 0.5 d
- Deploy a branch preview (`bun run preview`) with a trivial `public/sw.js` + `app/manifest.ts`.
- Confirm: URL of `sw.js` and manifest under `/ai-mock-interview/`; response headers from `_headers`; SW registers with scope `/ai-mock-interview/`; `run_worker_first` does not rewrite them.
- **Done when:** findings appended to design §6 (exact asset output path, header behaviour). No production code merged.

### T2 · [LABS01-184](https://linear.app/borderless-coding/issue/LABS01-184) [P] — Manifest, icons, metadata  `S` · 0.5 d  · PWA-01…04, 06
- `src/app/manifest.ts`, `public/icons/*` (192, 512, maskable 512), layout `viewport` + `appleWebApp`, `lang="en"`, title "Hone".
- **Done when:** DevTools Manifest pane = installable, no warnings, locally and on preview.

### T3 · [LABS01-185](https://linear.app/borderless-coding/issue/LABS01-185) [P] — Safe-area layout  `S` · 0.5 d  · PWA-05
- `viewport-fit=cover` aware padding on mobile top bar, sidebar drawer, interview + review composers.
- **Done when:** screenshots on iPhone (notch) standalone show no overlap; no change in desktop browser.

## Phase 2 — Service worker

### T4 · [LABS01-186](https://linear.app/borderless-coding/issue/LABS01-186) — Service worker core  `M` · 1.5 d  · PWA-10…16, 20
- `public/sw.js` + `public/sw-routes.js` (pure `classifyRequest`), `register-sw.tsx` (no dev registration unless flag), `/offline` page, `_headers`, `scripts/stamp-sw.mjs` wired into `build` and `build:cloudflare`, verify script asserts stamp.
- Unit tests for `classifyRequest`: cross-origin, `/api/auth`, POST, `text/event-stream`, `_next/static`, navigation, outside scope.
- **Done when:** offline reload of a visited page shows it; unvisited page shows `/offline`; interview SSE identical (manual, record TTFT before/after); Career Forge tab uncontrolled.

## Phase 3 — Offline experience & install

### T5 · [LABS01-187](https://linear.app/borderless-coding/issue/LABS01-187) [P] — Install UX + analytics  `S` · 1 d  · PWA-DEC-10, PWA-41
- `use-install-prompt.ts`, `install-app-button.tsx` (sidebar + dashboard card), iOS hint, 30-day dismissal, PostHog events + `display_mode` super property.
- **Done when:** unit matrix (Chromium / iOS / standalone) green; events visible in PostHog dev project.

### T6 · [LABS01-188](https://linear.app/borderless-coding/issue/LABS01-188) [P] — Network status, banner, disabled actions  `M` · 1 d  · PWA-21, 22, 25
- `use-network-status.ts`, `offline-banner.tsx` in `AppShell`, disable start/send/mic/upload/delete/apply with copy; suppress global query error toast while offline; regression test: network error never signs out.
- **Done when:** airplane-mode walkthrough has zero error toasts and zero sign-outs.

### T7 · [LABS01-189](https://linear.app/borderless-coding/issue/LABS01-189) [P] — Query persistence  `M` · 1 d  · PWA-23, 24, 26, PWA-DEC-07
- `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `idb-keyval`; allow-list roots; `gcTime` ≥ `maxAge`; `buster` = build id; `clearHoneOfflineData()` on logout and 401.
- Unit: allow-list ⊆ `queryKeys` roots; `resumes`/`session-quota` excluded; logout clears store.
- **Done when:** offline cold start shows dashboard, practice history, feedback, study backlog from cache.

## Phase 4 — Resilience

### T8 · [LABS01-191](https://linear.app/borderless-coding/issue/LABS01-191) — Update prompt with stream guard  `S` · 0.5 d  · PWA-40, PWA-DEC-08
- `stream-activity.ts`; chats mark active/inactive; toast shown on `waiting` SW only when no stream is active; Reload posts `HONE_SKIP_WAITING`, reloads on `controllerchange`.

### T9 · [LABS01-192](https://linear.app/borderless-coding/issue/LABS01-192) — Connection lost → Resume  `M` · 1 d  · PWA-31
- `ConnectionLostNotice` in interview + review chats; Resume invalidates messages and continues. No backend change.
- **Done when:** toggling network mid-turn recovers without page reload; no duplicated AI message.

## Phase 5 — Verification

### T10 · [LABS01-193](https://linear.app/borderless-coding/issue/LABS01-193) — Playwright PWA suite, device UAT, kill switch  `M` · 1 d  · PWA-30, 32, Acceptance 1–9
- Playwright: manifest, SW scope, offline reload with cached data, disabled start, SSE streams with SW active.
- `public/sw-kill.js` + runbook section in `frontend/docs/` (how to ship the kill switch).
- Run spec Acceptance 1–9 on real Android + iPhone; record results in this file.

---

**Estimate:** ~9 dev-days for one dev (Dev B), ~2 weeks calendar including reviews and device UAT. T2/T3 and T5/T6/T7 can be split with Dev A if the platform stream frees up.

## Validation log

| Date | Check | Result |
| ---- | ----- | ------ |
| — | — | — |
