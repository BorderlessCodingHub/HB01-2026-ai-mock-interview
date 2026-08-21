# Session Create Quota — Tasks

**Design**: `.specs/features/session-create-quota/design.md`  
**Spec**: `.specs/features/session-create-quota/spec.md`  
**Status**: Validated (T1–T18; automated gates 2026-08-19; Interactive UAT pending; git commits deferred — orchestrator did not commit per L-005 / user git rule)

**Test refs**: `backend/docs/TESTING.md`, `frontend/.specs/codebase/TESTING.md`

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

```
T1 [P] ──┐
T2 [P] ──┼──→ Phase 2
T3 [P] ──┘
T12 [P] ─┐
T13 [P] ─┴──→ Phase 6 (FE can start immediately)
```

### Phase 2: Error mapping + quota core

```
T3 ──→ T4 [P] ─┐
T1 ──→ T5     ─┼──→ T6 ──→ Phase 4
T2 ────────────┘
```

T4 (unit) and T5 (integration) may start in the same phase but **must not** share an agent that runs both Docker suites. T5 is not `[P]`.

### Phase 3: Session create on `tx` (Sequential — integration)

```
T7 → T8
```

### Phase 4: GET quota API (Sequential — e2e)

```
T6 ──→ T9
```

### Phase 5: Consume-on-create wiring (Sequential — e2e)

```
T4, T6, T7, T9 ──→ T10 ──→ T11
                        └── (T8)
```

### Phase 6: Start UX

```
T12 ──→ T14 ──┐
T12, T13 ─→ T15 ─┼──→ T16
                 ├─→ T17 [P]
                 └─→ T18 [P]
```

---

## Task Breakdown

### T1: Prisma `SessionQuotaEvent` + migration + truncate [P]

**What**: Add `SessionQuotaKind` enum and `SessionQuotaEvent` model (no `sessionId`) with `User.sessionQuotaEvents`; generate client + migration; list the new table in `truncateTables`.
**Where**: `backend/prisma/schema/user.prisma`, new Prisma migration under `backend/prisma/migrations/`, `backend/src/test/containers/truncate-tables.ts`
**Depends on**: None
**Reuses**: `UserTokenUsage` mapping (`@@map`, `Int userId`, `onDelete: Cascade` on **user** only)
**Requirement**: SCQ-01, SCQ-08, SCQ-24

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Enum `SessionQuotaKind { practice study }` and model match design (uuid id, `userId`, `kind`, `createdAt`, `@@index([userId, kind, createdAt])`, `@@map("session_quota_events")`)
- [x] `User` has `sessionQuotaEvents SessionQuotaEvent[]`; **no** relation to `InterviewSession` / `ReviewSession`
- [x] Migration created; `cd backend && bun run db:generate` succeeds
- [x] `truncateTables` SQL includes `"session_quota_events"` (CASCADE from `users` is not enough for explicit isolation)
- [x] No backfill / seed of historical sessions
- [x] Gate check passes: `cd backend && bun run check-types`

**Tests**: none (Prisma schema / test helper — not in coverage matrix)
**Gate**: build

**Verify**:
`cd backend && bun run db:generate && bun run check-types`  
`npx prisma migrate status` (or project equivalent) shows the new migration pending/applied locally.

**Commit**: `feat(session-quota): add session_quota_events sliding-log table`

---

### T2: Quota env vars + test MAX=500 overrides [P]

**What**: Add `SESSION_QUOTA_PRACTICE_MAX` (default 3), `SESSION_QUOTA_STUDY_MAX` (default 3), `SESSION_QUOTA_WINDOW_MS` (default 14400000) to server schema and `.env.example`; force MAX=500 in unit and e2e Vitest setups.
**Where**: `backend/src/config/env/server-schema.ts`, `backend/src/config/env/server-schema.test.ts`, `backend/.env.example`, `backend/vitest.setup.ts`, `backend/vitest.e2e.setup.ts`
**Depends on**: None
**Reuses**: `TOKEN_LIMIT_*` schema style; e2e **force-assign** pattern already used for `RATE_LIMIT_AI_MAX=500`
**Requirement**: SCQ-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Three vars use `z.coerce.number()` with defaults **3 / 3 / 14400000**
- [x] `.env.example` documents them
- [x] `server-schema.test.ts` asserts defaults when omitted
- [x] `vitest.setup.ts` and `vitest.e2e.setup.ts` **force** `SESSION_QUOTA_PRACTICE_MAX=500` and `SESSION_QUOTA_STUDY_MAX=500` (same reason as AI limiter — existing create-heavy suites)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/config/env/server-schema.test.ts`
- [x] Test count: existing 5 `server-schema.test.ts` tests + ≥1 new (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/config/env/server-schema.test.ts`

**Commit**: `feat(session-quota): add configurable quota env defaults`

---

### T3: `SessionQuotaExceededError` [P]

**What**: Add 429 `SessionQuotaExceededError` with distinct practice/study English messages, `retryAfterSeconds`, and `quota`; re-export from `shared`.
**Where**: `backend/src/shared/errors/http-errors.ts`, `backend/src/shared/errors/http-errors.test.ts` (new), `backend/src/shared/index.ts`
**Depends on**: None
**Reuses**: `TokenLimitExceededError` / `HttpError` subclass pattern
**Requirement**: SCQ-06, SCQ-12, SCQ-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `new SessionQuotaExceededError({ retryAfterSeconds, quota: "practice" | "study" })`
- [x] `statusCode === 429`; messages **exactly**:
  - practice: `"Practice session limit reached. You can start another after the waiting period."`
  - study: `"Study session limit reached. You can start another after the waiting period."`
- [x] Messages distinct from AI limiter (`Too many requests, please try again later.`) and `TokenLimitExceededError`
- [x] Exported from `shared/index.ts`
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/shared/errors/http-errors.test.ts`
- [x] Test count: ≥3 new unit tests (practice message, study message, status + fields)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/shared/errors/http-errors.test.ts`

**Commit**: `feat(session-quota): add SessionQuotaExceededError`

---

### T4: `errorHandler` Retry-After + quota 429 JSON [P]

**What**: When the mapped error has numeric `retryAfterSeconds`, set `Retry-After` and JSON `{ message, retryAfterSeconds }`; all other errors (including token 429) stay `{ message }`. Duck-type the field (do not rely on `instanceof` alone).
**Where**: `backend/src/shared/middlewares/error-handler-middleware.ts`, `backend/src/shared/middlewares/error-handler-middleware.test.ts`
**Depends on**: T3
**Reuses**: Existing `isHttpErrorLike` duck-typing; current `{ message }` default
**Requirement**: SCQ-12, SCQ-15

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Quota 429 → header `Retry-After` equals `String(retryAfterSeconds)` and body includes `message` + `retryAfterSeconds`
- [x] `TokenLimitExceededError` and generic `HttpError` still `{ message }` only — **no** `Retry-After`
- [x] Duck-type `retryAfterSeconds` as a number on the mapped error (module-instance safe)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/shared/middlewares/error-handler-middleware.test.ts`
- [x] Test count: existing 7 tests + ≥2 new (quota shape vs token 429 unchanged)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/shared/middlewares/error-handler-middleware.test.ts`

**Commit**: `feat(http): emit Retry-After for session quota 429`

---

### T5: `SessionQuotaRepository` + integration tests

**What**: Implement `lockBucket`, `listInWindow` (`createdAt > windowStart`, oldest first), and `insert` on an injected `tx`; integration-test against real Postgres.
**Where**: `backend/src/modules/session-quota/repository/session-quota-repository.ts`, `backend/src/modules/session-quota/repository/session-quota-repository.integration.test.ts`
**Depends on**: T1
**Reuses**: `TokenUsageRepository` injection style; Prisma `tx` from `$transaction`; `UserRepository` seed from other integration tests
**Requirement**: SCQ-01, SCQ-04, SCQ-05, SCQ-10, SCQ-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `lockBucket(tx, userId, kind)` runs `SELECT pg_advisory_xact_lock($kindCode, $userId)` with `practice = 1`, `study = 2`
- [x] `listInWindow` filters `createdAt > windowStart` (not `>=`); orders oldest first; scoped by `userId` + `kind`
- [x] `insert` writes kind + userId only (no session FK)
- [x] Integration: insert + list round-trip; event aged to `windowStart` is **not** listed; practice vs study independent; `lockBucket` inside `$transaction` completes
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test:integration -- src/modules/session-quota/repository/session-quota-repository.integration.test.ts`
- [x] Test count: ≥4 new integration tests

**Tests**: integration
**Gate**: full (integration)

**Verify**:
`cd backend && bun run test:integration -- src/modules/session-quota/repository/session-quota-repository.integration.test.ts`

**Commit**: `feat(session-quota): add SessionQuotaRepository with advisory lock`

---

### T6: `SessionQuotaService` + factory + unit tests

**What**: Implement `getSnapshot` and `runWithSlot` (lock → count → throw or `work(tx)` then insert) plus `makeSessionQuotaService()` from env.
**Where**: `backend/src/modules/session-quota/service/session-quota-service.ts`, `backend/src/modules/session-quota/service/session-quota-service.test.ts`, `backend/src/factories/session-quota/session-quota-service-factory.ts`
**Depends on**: T2, T3, T5
**Reuses**: `TokenUsageService` config-from-env singleton factory; `prisma.$transaction` from `@/infrastructure/database`
**Requirement**: SCQ-02, SCQ-03, SCQ-04, SCQ-05, SCQ-06, SCQ-09, SCQ-10, SCQ-11, SCQ-13, SCQ-14, SCQ-16, SCQ-17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Snapshot: `used` = in-window count; `limit` = max; `remaining = max(0, limit - used)`; `retryAfterSeconds` is `null` iff `remaining > 0`, else `max(1, ceil((oldest.createdAt + windowMs - now) / 1000))`
- [x] Inclusive rule: `createdAt > now - windowMs` (slot free at exact window age)
- [x] `runWithSlot`: `$transaction` → `lockBucket` → `listInWindow` → if `events.length >= max` throw `SessionQuotaExceededError` (**no** `work`, **no** insert) else `work(tx)` then `insert`
- [x] `MAX=0` always throws / snapshot `remaining=0`
- [x] Factory reads `env.SESSION_QUOTA_*` (never a literal 4h / 3 in service logic)
- [x] Unit tests mock repository + `$transaction` (fake `tx`)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/session-quota/service/session-quota-service.test.ts`
- [x] Test count: ≥6 new unit tests (snapshot remaining, retryAfter null, retryAfter ceil, window exclusive, throw without insert, success insert after work, optional MAX=0)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/session-quota/service/session-quota-service.test.ts`

**Commit**: `feat(session-quota): add SessionQuotaService sliding-log`

---

### T7: `SessionRepository.create` accepts transaction client

**What**: Add optional `db: Prisma.TransactionClient | PrismaClient = prisma` to `create` so the interview row can join the quota transaction; default keeps other callers unchanged.
**Where**: `backend/src/modules/interview/repository/session-repository.ts`, `backend/src/modules/interview/repository/session-repository.integration.test.ts`
**Depends on**: T1
**Reuses**: Existing `create` data payload; generated `PrismaClient` / `Prisma.TransactionClient`
**Requirement**: SCQ-02, SCQ-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `create(params, db = prisma)` uses `db.interviewSession.create` (not a hardcoded global when `db` is passed)
- [x] Default `prisma` path still creates a session (existing integration cases green)
- [x] New integration case: create inside `$transaction`, throw, **no** committed session (proves tx participation)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test:integration -- src/modules/interview/repository/session-repository.integration.test.ts`
- [x] Test count: existing session-repository integration tests + ≥1 new (no silent deletions)

**Tests**: integration
**Gate**: full (integration)

**Verify**:
`cd backend && bun run test:integration -- src/modules/interview/repository/session-repository.integration.test.ts`

**Commit**: `feat(interview): pass TransactionClient into SessionRepository.create`

---

### T8: `ReviewSessionRepository.create` accepts transaction client

**What**: Same optional `db` argument on review-session `create` (including nested items) so study persist shares the quota tx.
**Where**: `backend/src/modules/review-sessions/repository/review-session-repository.ts`, `backend/src/modules/review-sessions/repository/review-session-repository.integration.test.ts`
**Depends on**: T7
**Reuses**: Existing `create` include/`items.create` payload; T7 `db` signature style
**Requirement**: SCQ-03, SCQ-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `create(userId, items, interviewLocale, db = prisma)` uses `db.reviewSession.create`
- [x] Existing integration cases still pass
- [x] New integration case: tx rollback leaves no `ReviewSession` row
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test:integration -- src/modules/review-sessions/repository/review-session-repository.integration.test.ts`
- [x] Test count: existing review-session-repository integration tests + ≥1 new

**Tests**: integration
**Gate**: full (integration)

**Verify**:
`cd backend && bun run test:integration -- src/modules/review-sessions/repository/review-session-repository.integration.test.ts`

**Commit**: `feat(review-sessions): pass TransactionClient into ReviewSessionRepository.create`

---

### T9: `GET /api/session-quota` + E2E

**What**: Controller + factory + routes (`GET /` → 200 both buckets); no `aiRateLimiter`; E2E 401/200 (seed events via Prisma — create-path wiring is T10/T11).
**Where**:  
`backend/src/modules/session-quota/controller/session-quota-controller.ts`  
`backend/src/factories/session-quota/session-quota-controller-factory.ts`  
`backend/src/modules/session-quota/routes/session-quota-routes.ts`  
`backend/src/test/e2e/session-quota.e2e.test.ts`
**Depends on**: T6
**Reuses**: `users-routes.ts` (`asyncHandler`, no extra limiter); auto-mount via `config/routes.ts` folder name `session-quota`; `seedAuthenticatedUser` / `truncateTables`
**Requirement**: SCQ-10, SCQ-16, SCQ-17, SCQ-18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Route auto-mounts at `/api/session-quota`; `GET /` returns `{ practice, study }` each `{ used, limit, remaining, retryAfterSeconds }`
- [x] No writes (GET does not insert events or sessions); no `aiRateLimiter` on this router
- [x] Unauthenticated → 401; authenticated empty log → `used=0`, `remaining=limit`, `retryAfterSeconds=null`
- [x] Seed 3 in-window practice events via Prisma → GET `practice.remaining=0` and `retryAfterSeconds >= 1`; study unaffected
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`
- [x] Test count: ≥3 new e2e cases (401, 200 empty, 200 exhausted practice)

**Tests**: e2e (controller covered by e2e per TESTING.md)
**Gate**: full (e2e)

**Verify**:
`cd backend && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`

**Commit**: `feat(session-quota): expose GET /api/session-quota`

---

### T10: Practice create consumes quota + E2E

**What**: Inject `SessionQuotaService` into `SessionService`; validate resume **then** `runWithSlot(..., "practice")` wrapping `sessionRepository.create(..., tx)`; unit tests + extend `session-quota.e2e.test.ts` with MAX=3 `createApp()` describe. Do **not** call quota on list/get/delete/stream.
**Where**: `backend/src/modules/interview/service/session-service.ts`, `backend/src/modules/interview/service/session-service.test.ts`, `backend/src/factories/interview/session-service-factory.ts`, `backend/src/test/e2e/session-quota.e2e.test.ts` (extend)
**Depends on**: T4, T6, T7, T9
**Reuses**: Existing resume 404/400 order; `interview.e2e.test.ts` `vi.resetModules` + dynamic `createApp`; `seedReadyResume` / `buildCreateSessionPayload`
**Requirement**: SCQ-02, SCQ-06, SCQ-07, SCQ-08, SCQ-09, SCQ-10, SCQ-12, SCQ-13, SCQ-14, SCQ-15

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Resume missing/not ready still 404/400 **without** lock or quota insert (unit: `runWithSlot` not called)
- [x] Successful create runs inside `runWithSlot`; `create` receives `tx`
- [x] Exhausted bucket → `SessionQuotaExceededError`; no interview row
- [x] `deleteSession` unchanged (no quota call)
- [x] E2E describe: set `SESSION_QUOTA_PRACTICE_MAX=3` (study 500 or 3), `vi.resetModules()`, new `createApp()`, restore env after
- [x] E2E cases: 3 practice creates 201 + 4th 429 with `retryAfterSeconds` + `Retry-After`; other user still 201; stream on existing session 200; delete one interview then 4th create still 429; two concurrent creates at remaining=1 → exactly one 201
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/interview/service/session-service.test.ts && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`
- [x] Test count: existing 11 `session-service.test.ts` + ≥3 new unit; e2e file ≥ previous T9 cases + ≥5 new (no silent deletions)

**Tests**: unit + e2e
**Gate**: full

**Verify**:
`cd backend && bun run test -- src/modules/interview/service/session-service.test.ts`  
`cd backend && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`

**Commit**: `feat(interview): consume practice quota on session create`

---

### T11: Study create consumes quota + E2E

**What**: Same `runWithSlot(..., "study")` wrap on `ReviewSessionsService.create` after item validation; factory inject; E2E 4th review-session 429; study independent of practice.
**Where**: `backend/src/modules/review-sessions/service/review-sessions-service.ts`, `backend/src/modules/review-sessions/service/review-sessions-service.test.ts`, `backend/src/factories/review-sessions/review-sessions-service-factory.ts`, `backend/src/test/e2e/session-quota.e2e.test.ts` (extend)
**Depends on**: T6, T8, T10
**Reuses**: Existing “review item not found” before persist; T10 e2e env/`createApp` pattern; review-session seed helpers from `review-sessions.e2e.test.ts`
**Requirement**: SCQ-03, SCQ-04, SCQ-06, SCQ-07, SCQ-12, SCQ-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Missing review items → 404 **without** `runWithSlot`
- [x] Successful create uses `reviewSessionRepository.create(..., tx)` inside `runWithSlot` kind `study`
- [x] Practice vs study independent (unit + e2e: practice exhausted, study create 201 and reverse)
- [x] Resume/get/apply/stream review-session paths unchanged (no quota)
- [x] E2E: 4th `POST /api/review-sessions` is 429 with study message + `retryAfterSeconds`; GET study bucket `remaining=0`
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/service/review-sessions-service.test.ts && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`
- [x] Test count: existing 13 `review-sessions-service.test.ts` + ≥3 new unit; e2e prior cases + ≥2 new

**Tests**: unit + e2e
**Gate**: full

**Verify**:
`cd backend && bun run test -- src/modules/review-sessions/service/review-sessions-service.test.ts`  
`cd backend && bun run test:e2e -- src/test/e2e/session-quota.e2e.test.ts`

**Commit**: `feat(review-sessions): consume study quota on session create`

---

### T12: Frontend quota types + API client [P]

**What**: Add `QuotaBucket` / response types and `sessionQuotaApi.get(token)` calling `GET /api/session-quota`.
**Where**: `frontend/src/types/session-quota.ts`, `frontend/src/lib/api/session-quota.ts`
**Depends on**: None
**Reuses**: `interviewApi` + `apiRequest` pattern (`frontend/src/lib/api/interview.ts`)
**Requirement**: SCQ-16, SCQ-17, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Types: `{ used, limit, remaining, retryAfterSeconds: number | null }` per bucket; response `{ practice, study }`
- [x] Client uses `apiRequest` (401/5xx surface as `ApiError` with `body`)
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: `src/lib/api/` → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(session-quota): add quota API client and types`

---

### T13: `formatRetryAfter` [P]

**What**: Pure helper that formats whole seconds as `"1h 20m"` / `"12m"` (English, no “4 hours” literal).
**Where**: `frontend/src/features/session-quota/format-retry-after.ts`
**Depends on**: None
**Reuses**: None (new); keep UI strings out of page files
**Requirement**: SCQ-21, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `formatRetryAfter(seconds)` → `Xh Ym` when hours > 0, else `Xm` (ceil minutes as needed for leftover seconds; never empty when `seconds >= 1`)
- [x] No hardcoded window copy
- [x] Gate check passes: `cd frontend && bun run check-types`

**Tests**: none (FE matrix: `src/features/` → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(session-quota): add formatRetryAfter helper`

---

### T14: `queryKeys.sessionQuota` + `useSessionQuota`

**What**: Add query key `["session-quota"]` and `useSessionQuota()` (auth `enabled`, 60s refetch while any bucket `remaining === 0`).
**Where**: `frontend/src/lib/query/keys.ts`, `frontend/src/lib/query/hooks/use-session-quota.ts`
**Depends on**: T12
**Reuses**: `useSessions` auth/`enabled` pattern
**Requirement**: SCQ-19, SCQ-20, SCQ-21

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `queryKeys.sessionQuota = ["session-quota"] as const`
- [x] Hook returns React Query result for `{ practice, study }`; `enabled: isAuthenticated`
- [x] While either bucket `remaining === 0`, `refetchInterval` is 60000 (no 1s timer); otherwise no interval
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: hooks → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(session-quota): add useSessionQuota hook`

---

### T15: `SessionQuotaHint` component

**What**: Presentational hint: remaining line or countdown; hide on error/loading; copy from API `limit` / `retryAfterSeconds` via `formatRetryAfter` (elapsed since `dataUpdatedAt`).
**Where**: `frontend/src/features/session-quota/session-quota-hint.tsx`
**Depends on**: T12, T13
**Reuses**: Existing text-xs / text-text-base start-panel typography
**Requirement**: SCQ-19, SCQ-20, SCQ-21, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `remaining > 0` → `"{remaining} of {limit} sessions remaining"`
- [x] `remaining === 0` → `"Next session in {formatRetryAfter(effectiveSeconds)}"`
- [x] `isError` or missing bucket → render nothing (fail open)
- [x] English only; no hardcoded `3` or “4 hours”
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: features → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(session-quota): add SessionQuotaHint`

---

### T16: Wire quota UX on `/practice`

**What**: Load practice bucket on `practice/page.tsx`; show hint; disable Start when `remaining === 0` (not on GET error); toast `ApiError.message` on 429 and invalidate `sessionQuota`; invalidate quota on successful create.
**Where**: `frontend/src/app/(app)/practice/page.tsx`
**Depends on**: T14, T15
**Reuses**: Existing Start disabled conditions (creating / no ready resume); `queryClient.invalidateQueries`; `ApiError` from `frontend/src/lib/api/client.ts`
**Requirement**: SCQ-19, SCQ-21, SCQ-22, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `useSessionQuota` + `SessionQuotaHint` for **practice** near Start
- [x] Start disabled when `practice.remaining === 0` **and** query succeeded; GET error/loading does **not** add quota disable
- [x] Create catch toasts `err instanceof ApiError ? err.message : …` (replace generic failure string)
- [x] 429 and success both `invalidateQueries({ queryKey: queryKeys.sessionQuota })` (success also keeps sessions invalidate)
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: pages → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(practice): show session quota on Start`

---

### T17: Wire quota UX on `/practice/new` [P]

**What**: Same practice-bucket hint, disable, 429 invalidate, and success invalidate on `practice/new/page.tsx`.
**Where**: `frontend/src/app/(app)/practice/new/page.tsx`
**Depends on**: T14, T15
**Reuses**: Existing `ApiError` toast; Start disabled for resume-not-ready; T16 behavior
**Requirement**: SCQ-19, SCQ-21, SCQ-22, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Practice hint + disable when `remaining === 0` (fail open on `isError`)
- [x] 429 toast uses API `message`; invalidate `sessionQuota` on 429 and on success
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: pages → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(practice): show session quota on new-session Start`

---

### T18: Wire quota UX on Study start bar [P]

**What**: Pass study bucket into hub; show hint; disable `StudySelectionBar` when study `remaining === 0`; toast already uses `ApiError.message` — add `sessionQuota` invalidate on 429 and success.
**Where**: `frontend/src/features/study/study-selection-bar.tsx`, `frontend/src/features/study/study-hub-content.tsx`
**Depends on**: T14, T15
**Reuses**: Existing `isDisabled` (`selectedCount === 0 || isStarting`); `ApiError` catch already present
**Requirement**: SCQ-20, SCQ-21, SCQ-22, SCQ-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Bar accepts extra disable when quota exhausted (existing selection/starting rules still apply)
- [x] Hub renders `SessionQuotaHint` for **study** when the start bar is shown
- [x] GET error does not disable Start; `remaining === 0` does
- [x] Create success and 429 invalidate `queryKeys.sessionQuota`
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types`

**Tests**: none (FE matrix: features → none)
**Gate**: quick

**Verify**:
`cd frontend && bun run lint && bun run check-types && bun run build`

**Commit**: `feat(study): show session quota on Start review session`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P]   Prisma + truncate
  ├── T2 [P]   Env + MAX=500
  ├── T3 [P]   SessionQuotaExceededError
  ├── T12 [P]  FE types + API client
  └── T13 [P]  formatRetryAfter

Phase 2:
  ├── T4 [P]   errorHandler (needs T3) — unit, parallel-safe
  └── T5       SessionQuotaRepository (needs T1) — integration, NOT parallel-safe
  T2, T3, T5 complete → T6 SessionQuotaService + factory

Phase 3 (Sequential, integration):
  T7 ──→ T8

Phase 4 (Sequential, e2e):
  T6 ──→ T9   GET /api/session-quota

Phase 5 (Sequential, e2e):
  T4, T6, T7, T9 ──→ T10 ──→ T11
                         └── T8

Phase 6 (FE):
  T12 ──→ T14
  T12, T13 ──→ T15
  T14, T15 complete, then:
    ├── T16
    ├── T17 [P]
    └── T18 [P]
```

**Parallelism notes**:

- Backend **unit** is parallel-safe. **Integration** (`fileParallelism: false`, shared Postgres) and **E2E** (shared Testcontainers) are **not** — T5, T7, T8, T9, T10, T11 must not run in parallel with each other.
- T10 and T11 both extend `session-quota.e2e.test.ts` — sequential to avoid file races.
- FE has no automated tests; `[P]` is file-ownership only (T16 vs T17 vs T18).
- Orchestrator serializes git commits if Execute uses sub-agents (L-005).

---

## Validation Gates (pre-approval)

### Check 1: Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One Prisma model + migration + truncate line | ✅ Cohesive foundation |
| T2 | Env schema + test stubs | ✅ Cohesive |
| T3 | One error class | ✅ Granular |
| T4 | One middleware behavior | ✅ Granular |
| T5 | One repository | ✅ Granular |
| T6 | One service + factory (same as token-usage) | ✅ Cohesive |
| T7 | One repository method signature | ✅ Granular |
| T8 | One repository method signature | ✅ Granular |
| T9 | One HTTP endpoint (controller+route+e2e) | ✅ OK (one endpoint) |
| T10 | Interview create wiring + its HTTP e2e | ✅ Cohesive slice |
| T11 | Review-session create wiring + its HTTP e2e | ✅ Cohesive slice |
| T12 | Types + API client | ✅ Cohesive |
| T13 | One function | ✅ Granular |
| T14 | Key + hook | ✅ Cohesive |
| T15 | One component | ✅ Granular |
| T16 | One page | ✅ Granular |
| T17 | One page | ✅ Granular |
| T18 | Bar + hub (one study start surface) | ✅ Cohesive |

### Check 2: Diagram ↔ Depends On

| Task | Depends On (body) | Diagram shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ |
| T2 | None | Phase 1 root | ✅ |
| T3 | None | Phase 1 root | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T1 | T1 → T5 | ✅ |
| T6 | T2, T3, T5 | T2/T3/T5 → T6 | ✅ |
| T7 | T1 | After T1; Phase 3 start (T5 not a body dep) | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T6 | T6 → T9 | ✅ |
| T10 | T4, T6, T7, T9 | Phase 5 from those | ✅ |
| T11 | T6, T8, T10 | T10 → T11 and T8 | ✅ |
| T12 | None | Phase 1 root | ✅ |
| T13 | None | Phase 1 root | ✅ |
| T14 | T12 | T12 → T14 | ✅ |
| T15 | T12, T13 | T12,T13 → T15 | ✅ |
| T16 | T14, T15 | After T14+T15 | ✅ |
| T17 | T14, T15 | After T14+T15, `[P]` vs T16/T18 | ✅ |
| T18 | T14, T15 | After T14+T15, `[P]` vs T16/T17 | ✅ |

T7 is listed after T5 in Phase 3 only to avoid two integration suites in one agent turn — not a code dependency. Body `Depends on: T1` matches that.

### Check 3: Test Co-location

| Task | Code layer | Matrix requires | Task says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | Prisma schema / truncate helper | none | none | ✅ |
| T2 | `config/env` (validations-like) | unit | unit | ✅ |
| T3 | `shared/errors` (pure class) | unit (closest: unit infra) | unit | ✅ |
| T4 | `middlewares/` | unit | unit | ✅ |
| T5 | `repository/` | integration | integration | ✅ |
| T6 | `service/` | unit | unit | ✅ |
| T7 | `repository/` | integration | integration | ✅ |
| T8 | `repository/` | integration | integration | ✅ |
| T9 | HTTP routes (+ controller) | e2e (controller none) | e2e | ✅ |
| T10 | `service/` + existing HTTP create | unit + e2e (highest e2e) | unit + e2e | ✅ |
| T11 | `service/` + existing HTTP create | unit + e2e | unit + e2e | ✅ |
| T12 | `src/lib/api/` | none | none | ✅ |
| T13 | `src/features/` | none | none | ✅ |
| T14 | `src/lib/query/hooks/` | none | none | ✅ |
| T15 | `src/features/` | none | none | ✅ |
| T16 | `src/app/` pages | none | none | ✅ |
| T17 | `src/app/` pages | none | none | ✅ |
| T18 | `src/features/` | none | none | ✅ |

No test deferral: GET e2e lives in T9; create 429 e2e lives in T10/T11 with the wiring that changes those endpoints.

---

## Requirement traceability (tasks)

| IDs | Tasks |
| --- | ----- |
| SCQ-01, SCQ-08, SCQ-24 | T1, T5 |
| SCQ-02, SCQ-14 | T5, T6, T7, T10 |
| SCQ-03 | T6, T8, T11 |
| SCQ-04, SCQ-10 | T5, T6, T9, T10, T11 |
| SCQ-05, SCQ-17 | T5, T6, T9 |
| SCQ-06, SCQ-12, SCQ-13 | T3, T4, T6, T10, T11 |
| SCQ-07, SCQ-15 | T10, T11 (no quota on resume/stream; limiter untouched) |
| SCQ-09 | T6, T10 (empty create still inserts event) |
| SCQ-11 | T2, T6 |
| SCQ-16, SCQ-18 | T6, T9 |
| SCQ-19 | T14–T17 |
| SCQ-20 | T14, T15, T18 |
| SCQ-21, SCQ-23 | T13–T18 |
| SCQ-22 | T16, T17, T18 |
| SCQ-25–27 | Deferred — no tasks |
