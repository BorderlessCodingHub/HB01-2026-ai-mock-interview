# Session Create Quota — Specification

## Problem Statement

The platform already caps **AI HTTP requests** (`aiRateLimiter`, 60 / 15 min by `userId`) and **monthly tokens**, but a user can still open unlimited Practice interviews and Study review sessions. Each new session is a high-cost conversation. Operators need a **product quota on starting sessions**: 3 Practice + 3 Study creates per rolling 4 hours, with a visible remaining count and an honest countdown — not a generic “try again later”.

## Goals

- [x] Authenticated users can start at most **3 InterviewSessions** (`/practice`) and **3 ReviewSessions** (`/study`) in any rolling 4-hour window (independent buckets)
- [x] Quota is consumed on **create**; resume does not consume; delete does not refund; empty/abandoned sessions still count
- [x] Slots return **one at a time** (sliding window log): each create occupies a slot for 4 hours from its timestamp
- [x] Clients can read remaining quota **before** clicking Start; at zero, Start is disabled with time until the next slot
- [x] Limits are env-configurable (defaults: 3 + 3, window 4h)
- [x] Existing `RATE_LIMIT_AI_*` and monthly token limits stay unchanged

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Changing `aiRateLimiter` (stream / resume upload / STT) | Complementary request-level protection; grill Q6 = keep as-is |
| Monthly token cap (`TOKEN_LIMIT_*`) | Complementary cost control; unchanged |
| Auth rate limiter (`RATE_LIMIT_*` by IP) | Login abuse, not session quota |
| Counting stream turns as quota | Grill Q2 = create only; a 10-turn interview must not consume 10 slots |
| Refund on delete / grace for empty sessions | Grill Q9/Q10; would allow create → spend LLM → delete → recreate |
| Token bucket / leaky bucket / fixed window / sliding counter | Grill Q4 = sliding log (hard cap of 3 in any 4h + honest countdown) |
| Backfill of existing sessions at deploy | First 4h after ship, only new creates count |
| Per-user tiers, paid plans, admin overrides | Same limits for every authenticated user |
| PT (or other) UI copy for quota | Grill Q12 = English, matching current start screens |
| Quota UI outside start surfaces | Minimal UX: `/practice`, `/practice/new`, `/study` start bar |
| Quota on `GET` session lists, delete, apply, feedback, messages | Read/lifecycle routes are not “start a session” |
| Client-side counting from session lists | Study list is paginated; delete would fake a refund |
| Scheduled purge / cron / BullMQ job to delete old quota rows | Current usage is tiny (~6 events/user/4h); queries already ignore rows outside the window. Hygiene job adds worker/scheduler complexity for no product value — revisit if the table ever becomes large |

## Relationship to Existing Features

| Feature / code | Relevance |
| -------------- | --------- |
| [ai-rate-limit-by-user](../../backend/.specs/features/ai-rate-limit-by-user/spec.md) | Request limiter on stream/upload/STT; **not** replaced |
| [token-usage-limits](../../backend/.specs/features/token-usage-limits/spec.md) | Monthly token 429; session-quota 429 MUST use a distinct message |
| `POST /api/interview/sessions` | Practice create — consumes the **practice** bucket |
| `POST /api/review-sessions` | Study create — consumes the **study** bucket |
| `DELETE /api/interview/sessions/:sessionId` | Hard delete exists; MUST NOT remove the quota event |
| Review session resume banner / `in_progress` | Resume MUST NOT consume a new slot |
| `TokenLimitExceededError` → `{ message }` 429 | Session quota needs the same status plus machine-readable retry |

---

## Decisions (resolved in grill-me)

| ID | Decision |
| -- | -------- |
| SCQ-DEC-01 | Two independent buckets: Practice = InterviewSession create; Study = ReviewSession create |
| SCQ-DEC-02 | Consume on **create**. Resume / continue does not consume |
| SCQ-DEC-03 | Algorithm: **sliding window log**. Max N events with `createdAt > now - window`. Slots free one-by-one when each event ages out |
| SCQ-DEC-04 | Applies to every authenticated user; no tiers |
| SCQ-DEC-05 | Keep `aiRateLimiter` 60 / 15 min unchanged |
| SCQ-DEC-06 | UX: show remaining **before** Start; at limit, disable Start + countdown (“next session in Xm”) |
| SCQ-DEC-07 | Scope: backend enforcement + dedicated GET + minimal start UX (English) |
| SCQ-DEC-08 | Delete does **not** refund. Source of truth is a **persistent create log**, not live session rows |
| SCQ-DEC-09 | Abandoned / zero-turn sessions still count |
| SCQ-DEC-10 | Dedicated `GET` returns both buckets (`used`, `limit`, `remaining`, `retryAfterSeconds`) |
| SCQ-DEC-11 | Limits via env with defaults 3 / 3 / 4h; UI reads numbers from the API, does not hardcode “3 / 4 hours” |
| SCQ-DEC-12 | No backfill at deploy |
| SCQ-DEC-13 | **No purge job in this feature.** Expired log rows stay in Postgres; create/GET/429 filter `createdAt > now - window` and do not depend on deletion. Overturns the earlier daily-cron idea (complexity vs current usage) |

---

## User Stories

### P1: Enforce sliding-log quota on session create ⭐ MVP

**User Story**: As a platform operator, I want each authenticated user limited to 3 new Practice interviews and 3 new Study review sessions in any rolling 4 hours so that AI cost stays bounded without blocking turns inside an already-started session.

**Why P1**: Core product rule; without server enforcement the UI is advisory only.

**Acceptance Criteria**:

1. WHEN an authenticated user calls `POST /api/interview/sessions` THEN the system SHALL count **practice** quota events for that `userId` with `createdAt > (now - SESSION_QUOTA_WINDOW_MS)`
2. WHEN that count is **less than** `SESSION_QUOTA_PRACTICE_MAX` THEN the system SHALL create the InterviewSession **and** persist a practice quota event in the same transaction, then return the existing create success contract
3. WHEN that count is **greater than or equal to** `SESSION_QUOTA_PRACTICE_MAX` THEN the system SHALL respond **429**, SHALL NOT create an InterviewSession, and SHALL NOT persist a new quota event
4. WHEN an authenticated user calls `POST /api/review-sessions` THEN the same rules SHALL apply to the **study** bucket (`SESSION_QUOTA_STUDY_MAX`), independently of practice
5. WHEN the user resumes an `in_progress` (or otherwise existing) interview or review session THEN the system SHALL NOT persist a quota event and SHALL NOT increment either bucket
6. WHEN the user deletes an InterviewSession THEN the system SHALL NOT delete or invalidate the corresponding quota event
7. WHEN a session is created and the user never sends a turn THEN the quota event SHALL still count toward the window
8. WHEN two different authenticated users create sessions THEN each user’s buckets SHALL be independent
9. WHEN `SESSION_QUOTA_PRACTICE_MAX`, `SESSION_QUOTA_STUDY_MAX`, and `SESSION_QUOTA_WINDOW_MS` are unset THEN the system SHALL use defaults **3**, **3**, and **14400000** (4 hours)
10. WHEN `aiRateLimiter` or monthly token checks run THEN their configuration and route coverage SHALL be unchanged by this feature
11. WHEN a 429 is caused by this quota THEN the JSON body SHALL include at least `{ message, retryAfterSeconds }` where `retryAfterSeconds` is the whole seconds until the oldest event in that bucket exits the window, AND the response SHALL include header `Retry-After` with the same integer
12. WHEN a 429 is caused by this quota THEN `message` SHALL be distinct from the AI request limiter (`Too many requests, please try again later.`) and from `TokenLimitExceededError`
13. WHEN the oldest event’s age equals or exceeds the window THEN that event SHALL NOT count (slot is free at the instant the window elapses)
14. WHEN two concurrent creates hit a bucket with `remaining = 1` THEN the system SHALL allow **at most one** to succeed (the other SHALL be 429)

**Independent Test**: Auth as user A. Create 3 practice sessions → 4th `POST /api/interview/sessions` is 429 with `retryAfterSeconds` > 0. Same user can still create a study session. User B can still create practice sessions. Stream on an existing session is not rejected by this quota. Delete one practice session and immediately create again → still 429. After waiting `retryAfterSeconds`, create succeeds (1 slot), not 3.

---

### P1: Read remaining quota before starting ⭐ MVP

**User Story**: As a candidate, I want to see how many Practice and Study sessions I have left (and when the next one returns) without burning a click that fails.

**Why P1**: Grill Q7-C; lists cannot answer this (pagination + no-refund).

**Acceptance Criteria**:

1. WHEN an authenticated user calls `GET /api/session-quota` THEN the system SHALL return **200** with both buckets:

   ```json
   {
     "practice": {
       "used": 2,
       "limit": 3,
       "remaining": 1,
       "retryAfterSeconds": null
     },
     "study": {
       "used": 3,
       "limit": 3,
       "remaining": 0,
       "retryAfterSeconds": 4800
     }
   }
   ```

2. WHEN `remaining > 0` for a bucket THEN `retryAfterSeconds` for that bucket SHALL be `null`
3. WHEN `remaining = 0` THEN `retryAfterSeconds` SHALL be the seconds until the oldest event in that bucket exits the window (≥ 1 if still blocked)
4. WHEN `used` / `limit` / `remaining` are returned THEN they SHALL reflect the same sliding-log count the create path uses (`used + remaining = limit` when `used ≤ limit`)
5. WHEN the caller is unauthenticated THEN `GET /api/session-quota` SHALL return **401** (same auth as other user APIs)
6. WHEN the GET runs THEN it SHALL NOT create quota events or sessions

**Independent Test**: Create 2 practice sessions → GET shows `practice.used = 2`, `remaining = 1`, `retryAfterSeconds = null`. Create a 3rd → GET shows `remaining = 0` and a positive `retryAfterSeconds` matching the next 429.

---

### P1: Minimal Start UX on Practice and Study ⭐ MVP

**User Story**: As a candidate on `/practice`, `/practice/new`, or `/study`, I want the Start control to show remaining sessions and to block with a countdown when I am at the limit so I am not surprised by a failed create.

**Why P1**: Agreed vertical slice (grill Q8); backend-only 429 would surface as a generic toast.

**Acceptance Criteria**:

1. WHEN the user opens `/practice` or `/practice/new` THEN the UI SHALL load `GET /api/session-quota` and display **practice** remaining vs `limit` before they submit a new interview (English copy)
2. WHEN the user opens `/study` with the start bar available THEN the UI SHALL load the same GET and display **study** remaining vs `limit`
3. WHEN `remaining > 0` for that page’s bucket THEN Start SHALL stay enabled (existing validation still applies: resume ready, topics selected, etc.)
4. WHEN `remaining = 0` THEN Start SHALL be disabled and the UI SHALL show time until the next slot derived from `retryAfterSeconds` (e.g. “Next session in 1h 20m”), updating as time passes or on refetch
5. WHEN create still returns 429 (race) THEN the UI SHALL toast the API `message` and refresh quota so the button/countdown match the server
6. WHEN copy is shown THEN it SHALL be English (no `interviewLocale` branching for this feature)
7. WHEN the UI renders limits THEN it SHALL use `limit` / `retryAfterSeconds` from the API, not hardcoded “3” or “4 hours”

**Independent Test**: With remaining ≥ 1, start a session as today. Exhaust practice quota → `/practice` and `/practice/new` Start disabled with countdown; `/study` Start still enabled if study remaining > 0. Exhaust study → reverse. After countdown elapses (or GET refetch), Start enables for one slot.

---

## Edge Cases

- WHEN a quota event exists and the InterviewSession row is later hard-deleted THEN GET/create SHALL still count that event until it ages out
- WHEN ReviewSession has no delete API THEN study events still MUST live in the quota log (same model as practice, for symmetry and future delete)
- WHEN `SESSION_QUOTA_*_MAX` is `0` THEN every create of that kind SHALL be 429 and GET SHALL show `remaining = 0` (ops kill-switch)
- WHEN the window elapses on the oldest of three events created minutes apart THEN remaining becomes 1, not 3
- WHEN practice is exhausted and study is not (or the reverse) THEN only the exhausted Start control is disabled
- WHEN GET fails (network/5xx) THEN Start MAY stay enabled and rely on create 429 + toast (do not fake remaining = 0)
- WHEN `retryAfterSeconds` is returned THEN it SHALL be computed from server UTC; the UI SHALL treat it as a relative duration, not a wall-clock timezone
- WHEN stream, transcribe, or resume upload hit `aiRateLimiter` or token limit THEN this feature SHALL NOT change those 429 bodies
- WHEN quota events older than the window remain in the table THEN create/GET/429 SHALL ignore them (filter by `createdAt`); leftover rows SHALL NOT change remaining

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| SCQ-01 | P1: Enforce — persist create log independent of session rows | Tasks | Verified |
| SCQ-02 | P1: Enforce — consume on InterviewSession create (same transaction) | Tasks | Verified |
| SCQ-03 | P1: Enforce — consume on ReviewSession create (same transaction) | Tasks | Verified |
| SCQ-04 | P1: Enforce — independent practice vs study buckets | Tasks | Verified |
| SCQ-05 | P1: Enforce — sliding window `createdAt > now - windowMs` | Tasks | Verified |
| SCQ-06 | P1: Enforce — 429 on exhausted bucket; no session row | Tasks | Verified |
| SCQ-07 | P1: Enforce — resume does not consume | Tasks | Verified |
| SCQ-08 | P1: Enforce — delete does not refund | Tasks | Verified |
| SCQ-09 | P1: Enforce — empty/abandoned create still counts | Tasks | Verified |
| SCQ-10 | P1: Enforce — per authenticated userId; same limits for all | Tasks | Verified |
| SCQ-11 | P1: Enforce — env defaults 3 / 3 / 4h | Tasks | Verified |
| SCQ-12 | P1: Enforce — 429 `{ message, retryAfterSeconds }` + `Retry-After` | Tasks | Verified |
| SCQ-13 | P1: Enforce — message distinct from AI limiter and token cap | Tasks | Verified |
| SCQ-14 | P1: Enforce — concurrent remaining=1 allows a single success | Tasks | Verified |
| SCQ-15 | P1: Enforce — `aiRateLimiter` and token limits unchanged | Tasks | Verified |
| SCQ-16 | P1: Read — `GET /api/session-quota` both buckets | Tasks | Verified |
| SCQ-17 | P1: Read — `retryAfterSeconds` null iff remaining > 0 | Tasks | Verified |
| SCQ-18 | P1: Read — GET is authenticated; does not write events | Tasks | Verified |
| SCQ-19 | P1: UX — remaining on `/practice` and `/practice/new` (practice bucket) | Tasks | Verified |
| SCQ-20 | P1: UX — remaining on `/study` start bar (study bucket) | Tasks | Verified |
| SCQ-21 | P1: UX — disable Start + countdown when remaining = 0 | Tasks | Verified |
| SCQ-22 | P1: UX — 429 race toast + quota refetch | Tasks | Verified |
| SCQ-23 | P1: UX — English copy; limits from API not hardcoded | Tasks | Verified |
| SCQ-24 | P1: Enforce — no backfill of pre-feature sessions | Tasks | Verified |
| SCQ-25 | Deferred — daily purge job | — | Deferred |
| SCQ-26 | Deferred — missed purge must not affect quota | — | Deferred |
| SCQ-27 | Deferred — purge predicate uses window env | — | Deferred |

**ID format:** `SCQ-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 24 in MVP, 24 mapped to tasks (T1–T18), 3 deferred (purge SCQ-25–27)

---

## Success Criteria

- [x] A user cannot start a 4th Practice or 4th Study session inside any rolling 4h window
- [x] The next slot appears when the oldest create in that bucket turns 4h old — one slot, not a full reset
- [x] Resume, stream turns, STT, and resume upload are not charged as session-quota events
- [x] Deleting an interview does not restore a slot
- [x] `/practice`, `/practice/new`, and `/study` show remaining quota and a countdown at the limit, in English
- [x] Ops can change maxima and window via env without a code change
- [x] Existing AI request limiter and monthly token cap still behave as today
