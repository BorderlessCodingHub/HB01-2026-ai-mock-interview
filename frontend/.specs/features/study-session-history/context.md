# Study Session History — Context

**Gathered:** 2026-07-28 (grill-me session + user confirmation)
**Spec:** `.specs/features/study-session-history/spec.md`
**Status:** Ready for design → Design drafted (awaiting approval)

---

## Feature Boundary

Deliver **persisted completed Review Session history** on `/study`, visually and structurally similar to `/practice` previous conversations: a sidebar of past sessions and a main panel that shows either the Study hub (Active \| Learned) or a **read-only Q&A transcript**. Open sessions stay on the resume banner. Requires backend `GET /api/review-sessions` (list) and exposing `turns` on `GET /:id`.

Does **not** include report/outcomes replay, editing completed sessions, or putting open sessions in the history sidebar.

---

## Implementation Decisions

### Layout & navigation

- **Practice-like shell** on `/study`: left sidebar = history; main panel = Active/Learned hub **or** transcript.
- Deep-link: **`/study?sessionId=...`** (mirrors `/practice?sessionId=`).
- Without `sessionId` → hub tabs; with `completed` id → transcript; with `in_progress` / `pending_review` → **redirect** to existing resume routes (`/review-session/[id]` or `.../report`).
- Live Q&A remains on `/review-session/[id]` (not embedded in the study shell during an active session).

### History list content

- Sidebar shows **only `completed`** sessions.
- Each row: **topic names** (summary) + **date** + **Completed** badge.
- Pagination: **10 per page**, load more / next page, newest first.
- Empty sidebar copy in English (exact string at agent discretion).

### Transcript

- Read-only Q&A bubbles from server `turns` (`{ question, answer }` per turn, already stored on `ReviewSessionItem`).
- **No** composer, **no** SSE, **no** link to applied outcomes/report in MVP.
- Topic dividers when mapping per-item turns: allowed (agent discretion).

### Resume banner

- Remains the only UI for `in_progress` / `pending_review`.
- Data source: **same** `GET /api/review-sessions` filtered to open statuses (most recently created when multiple).
- Prefer API over `sessionStorage`-only last-id (storage may remain as optional cache, not source of truth).

### Backend contract

- One list endpoint with `status` + `page`/`limit`.
- List payloads are **lightweight** (id, status, topics[], createdAt, completedAt) — no turns in list.
- Detail `GET /:id` includes `turns` on each item; report fields unchanged.

### Language

- English UI strings for this feature.

### Agent's Discretion

- Exact sidebar heading (“Previous review sessions” vs “History”).
- Topic truncation / tooltip when many topics on one row.
- Infinite query vs explicit page buttons for Load more.
- Sort field (`completedAt` vs `createdAt`) — prefer `completedAt` desc with `createdAt` fallback.
- Whether to keep writing last session id to `sessionStorage` as a hint after create (non-authoritative).
- Mobile: stack sidebar above main (like practice) vs collapsible drawer.
- Mapping turns → `ReviewDisplayMessage` (reuse `review-display-messages` helpers where useful).

---

## Specific References

- Parent deferred item: `frontend/.specs/features/study-hub-review-sessions/context.md` → “Completed session history”.
- Practice UI: `frontend/src/app/(app)/practice/page.tsx` (sidebar “Previous Conversations”).
- Study hub: `frontend/src/features/study/study-hub-content.tsx`.
- Turn shape: `backend/src/modules/review-sessions/types/review-session-record.ts` → `ReviewSessionTurn`.
- Current GET report shape (no turns): `backend/docs/frontend-mock-interview-api.md`.

---

## Deferred Ideas

- **View applied outcomes** from a completed session (read-only report).
- **Inline outcomes** in transcript headers (topic → learned / priority).
- **Delete** history entries.
- **Search / filter** history by topic.
- Hydrating **in-progress** Q&A from server turns on resume (today chat is local-only mid-session).
- Portuguese localization.
