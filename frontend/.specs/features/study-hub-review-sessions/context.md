# Study Hub & Review Sessions — Context

**Gathered:** 2026-07-07 (grill-me session + user confirmation)
**Spec:** `.specs/features/study-hub-review-sessions/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Deliver a dedicated `/study` hub where candidates manage their review backlog (`active` and `learned` topics), start user-initiated **Review Sessions** (multi-select → adaptive Q&A over SSE → editable suggestion report), and persist outcomes to the backend. The UI reuses the existing interview chat/SSE patterns. Confirmation of session suggestions is **batch-only** (single Apply action), including auto-apply on navigation away — which requires a **backend API change** from per-item confirm to bulk apply.

---

## Implementation Decisions

### Scope & MVP

- **In scope (MVP+):** P1 Review Session lifecycle, `/study` hub with Active | Learned tabs, multi-select session start, manual mark learned / reactivate, delete on both statuses, resume banner for interrupted sessions.
- **Out of scope for this iteration:** completed session history list, bulk "accept all" as a separate shortcut (Apply already applies all), spaced repetition, system-suggested session prompts, user-configurable question count.

### Information architecture & navigation

- New route **`/study`** as the primary hub (not an extension of `/feedback`).
- Review Session Q&A at **`/review-session/[sessionId]`** (chat-like, mirrors `/interview/[sessionId]`).
- Suggestion report at **`/review-session/[sessionId]/report`**.
- Add `/study` to the authenticated app navigation (`AppShell` sidebar).

### Review Session Q&A UX

- Reuse the **interview chat pattern**: streaming tokens, message list, text input, optimistic pending state, abort on unmount.
- Show per-topic progress in meta (e.g. "Topic 2/3 — Question 2/3") derived from SSE `meta` payload (`itemIndex`, `totalItems`, `turnsCompleted`, `questionsPerItem`).
- On final SSE `meta` with `status: "pending_review"` (and embedded `report`), redirect to the report route.

### Report & confirmation UX

- One **editable card per session item**: topic, current priority, suggested outcome; user can change priority (`low` | `medium` | `high`) or mark as learned.
- **Single "Apply" button** applies **all** cards in one action (not per-item confirm buttons).
- **On leave without clicking Apply** (route change, close tab, browser back): auto-apply the **current edited state** of every card (implicit override — user edits win over raw suggestions).
- Language: **English** for all new copy.

### Session start & selection

- **Multi-select** checkboxes on Active tab cards.
- **"Start review session"** button enabled when 1–10 items selected (backend max).
- Toast or inline feedback when user tries to select an 11th item.

### Interrupted sessions

- If the user has a session in `in_progress` or `pending_review`, show a **resume banner** on `/study` linking to the appropriate route (`/review-session/[id]` or `/report`).

### Manual item actions (outside sessions)

- **Mark as learned** on active items (`PATCH { status: "learned" }`).
- **Reactivate** on learned items (`PATCH { status: "active" }`).
- **Delete** on both active and learned (`DELETE`).

### Backend contract change (user-mandated)

- Replace per-item `POST /api/review-sessions/:id/items/:itemId/confirm` with a **bulk apply** endpoint, e.g. `POST /api/review-sessions/:id/apply`.
- Request body carries decisions for **all** session items in one call; session transitions to `completed` when all items are applied.
- Per-item confirm endpoint should be **removed or deprecated** once bulk apply ships.
- Frontend must not ship report Apply/auto-apply until bulk apply exists on the backend.

### Agent's Discretion

- Exact sidebar label/icon for `/study` (recommendation: "Study" + `BookOpen` or `Dumbbell`).
- Card layout density and priority badge styling (reuse `ReviewItemsGrid` tokens).
- Whether auto-apply on leave uses `fetch` with `keepalive: true` vs `sendBeacon` (prefer reliability on tab close).
- Evaluation-failed items (`suggestedStatus: null`): show inline warning; card remains fully editable; included in bulk apply as user-edited override.
- Minor empty-state copy on Learned tab.

---

## Specific References

- Backend feature: `Backend/.specs/features/review-items-learned-status/` (spec, design, tasks — executed 2026-07-07).
- API contract reference: `Backend/docs/frontend-mock-interview-api.md` (review-items + review-sessions sections).
- Frontend SSE pattern: `src/lib/api/interview-stream.ts`, `src/features/interview/interview-chat.tsx`.
- Existing review items UI (read-only): `src/features/dashboard/review-items-grid.tsx`, `/feedback` page.

---

## Deferred Ideas

- **Completed session history** — spun out to [study-session-history](../study-session-history/spec.md) (specified 2026-07-28; transcript-only MVP, not outcomes).
- **"Review all high priority" shortcut** — pre-select high-priority items before session start.
- **Per-item review** — one-click "Review this topic" starting a single-item session (backend already supports it; UI deferred).
- **Portuguese localization** — user chose English for this feature; i18n later.
- **Link from `/feedback`** to `/study` for full backlog management (optional cross-link, not required for MVP).
