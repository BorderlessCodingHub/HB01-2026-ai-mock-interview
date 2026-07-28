# Study Session History — Tasks

**Design**: `.specs/features/study-session-history/design.md`  
**Spec**: `.specs/features/study-session-history/spec.md`  
**Status**: Implemented

---

## Test Coverage Matrix

### Frontend (`.specs/codebase/TESTING.md`)

| Code layer | Test type | Parallel-Safe |
|---|---|---|
| `src/types/` | none | N/A |
| `src/lib/api/` | none (recommended: unit) | Yes |
| `src/lib/query/hooks/` | none (recommended: unit) | Yes |
| `src/features/` | none (recommended: component) | Yes |
| `src/app/` (pages) | none (recommended: E2E) | Yes |

**FE gates:**

| Gate | Command (cwd `frontend/`) |
|---|---|
| `quick` | `bun run lint && bun run check-types` |
| `build` | `bun run lint && bun run check-types && bun run build` |

### Backend (`backend/docs/TESTING.md`)

| Code layer | Test type | Parallel-Safe |
|---|---|---|
| `validations/`, `service/` | **unit** | Yes (unit) |
| `repository/` | **integration** | No (Docker / DB) |
| HTTP routes | **e2e** | No (Docker) |
| `controller/` | none (covered by e2e) | N/A |

**BE gates:**

| Gate | Command (cwd `backend/`) |
|---|---|
| `quick` | `bun run lint && bun run check-types && bun run test` |
| `integration` | `bun run test:integration` (Docker) |
| `full` | `bun run test:all` (Docker) |

---

## Cross-Repo Dependency

**Backend Phase 1 (T1–T4)** must complete before frontend history/transcript can be verified against a live API. FE types/UI (T5+) may be coded from the design contract in parallel with BE, but **Done when** for T10–T11 requires T4 live.

---

## Execution Plan

### Phase 1: Backend (list + turns)

```
T1 [P] ──┐
T2 [P] ──┼──→ T3 ──→ T4
```

### Phase 2: Frontend foundation (types → API → hooks; pure helpers parallel)

```
T5 ──┬──→ T6 ──→ T7
     ├──→ T8 [P]
     └──→ T9 [P]
```

### Phase 3: UI (sidebar + transcript → shell → banner)

```
T4 + T7 + T9 ──→ T10 [P] ──┐
T4 + T7 + T8 ──→ T11 [P] ──┼──→ T12 ──→ T13 ──→ T14
```

---

## Task Breakdown

### T1: List query Zod schema [P]

**What**: Add `listReviewSessionsQuerySchema` parsing comma-separated `status`, `page`, `limit` (defaults per design).  
**Where**: `backend/src/modules/review-sessions/validations/review-session-schemas.ts` (+ `review-session-schemas.test.ts`)  
**Depends on**: None  
**Reuses**: `reviewSessionStatusSchema`; query parse pattern from `listReviewItemsQuerySchema`  
**Requirement**: SSHIST-01, SSHIST-02, SSHIST-DES-11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Schema accepts `status=completed`, `status=in_progress,pending_review`, `page`, `limit`
- [ ] Invalid status / empty status → Zod failure
- [ ] Defaults: `page=1`, `limit=10`
- [ ] Unit tests cover happy + invalid cases
- [ ] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/validations/review-session-schemas.test.ts`
- [ ] Test count: existing schema tests + new cases pass (no silent deletions)

**Tests**: unit  
**Gate**: quick  

**Commit**: `feat(review-sessions): add list query schema`

---

### T2: Repository `findManyByUserId` [P]

**What**: Lean paginated find of sessions by user + status `in`, ordered per `SSHIST-DES-01`, with items ordered for topics.  
**Where**: `backend/src/modules/review-sessions/repository/review-session-repository.ts` (+ `*.integration.test.ts`)  
**Depends on**: None  
**Reuses**: Existing `toReviewSessionRecord` / create helpers in integration tests  
**Requirement**: SSHIST-01, SSHIST-02, SSHIST-DES-01, SSHIST-DES-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `findManyByUserId({ userId, statuses, skip, take })` implemented
- [ ] Order: `completedAt desc`, `createdAt desc`; items by `order asc`
- [ ] Ownership scoped to `userId`
- [ ] Integration tests: filter by status, pagination skip/take, topic order
- [ ] Gate: `bun run test:integration -- src/modules/review-sessions/repository/review-session-repository.integration.test.ts` (Docker)
- [ ] Test count: prior repo tests + new cases pass

**Tests**: integration  
**Gate**: integration  

**Commit**: `feat(review-sessions): add paginated findManyByUserId`

---

### T3: Service `list` + expose `turns` on report

**What**: Implement `list()` returning summaries + `hasMore` (`limit+1`); add `turns` to `toReportItem` / `ReviewSessionReportItem`.  
**Where**: `backend/src/modules/review-sessions/service/review-sessions-service.ts` (+ `review-sessions-service.test.ts`)  
**Depends on**: T1, T2  
**Reuses**: Existing `getById` / `toReport` patterns  
**Requirement**: SSHIST-01–04, SSHIST-DES-05, SSHIST-DES-12

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `list(userId, { statuses, page, limit })` → `{ sessions, page, limit, hasMore }`
- [ ] Summary shape: `id`, `status`, `topics[]`, `createdAt` ISO, `completedAt` ISO \| null
- [ ] `getById` / apply response items include `turns: { question, answer }[]`
- [ ] Unit tests for list mapping, hasMore true/false, turns on report
- [ ] Gate: `bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/service/review-sessions-service.test.ts`
- [ ] Test count: prior service tests + new cases pass

**Tests**: unit  
**Gate**: quick  

**Commit**: `feat(review-sessions): list sessions and expose turns on report`

---

### T4: Controller `list` + route + E2E + API docs

**What**: Wire `GET /api/review-sessions` (before `/:id`); parse query in controller like review-items; E2E for list/pagination/turns; update API docs.  
**Where**:  
- `backend/src/modules/review-sessions/controller/review-sessions-controller.ts`  
- `backend/src/modules/review-sessions/routes/review-sessions-routes.ts`  
- `backend/src/test/e2e/review-sessions.e2e.test.ts`  
- `backend/docs/frontend-mock-interview-api.md`  
**Depends on**: T3  
**Reuses**: `ReviewItemsController.list` query `safeParse` pattern; existing review-sessions E2E helpers  
**Requirement**: SSHIST-01–04, SSHIST-DES-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `GET /` registered **before** `GET /:id`
- [ ] 200 list + 422 invalid query; auth 401 consistent with other routes
- [ ] E2E: empty list; completed appears after apply; open filter; pagination `hasMore`; GET `/:id` includes `turns`
- [ ] Docs updated (list + turns)
- [ ] Gate: `bun run test:e2e -- src/test/e2e/review-sessions.e2e.test.ts` (Docker) + `bun run check-types`
- [ ] Test count: prior e2e cases + new cases pass

**Tests**: e2e  
**Gate**: full (e2e suite file)  

**Commit**: `feat(review-sessions): expose list endpoint and document turns`

---

### T5: Frontend types for list + turns

**What**: Add `ReviewSessionTurn`, `ReviewSessionSummary`, `ListReviewSessionsResponse`; add `turns` to session item report type.  
**Where**: `frontend/src/types/review-sessions.ts`  
**Depends on**: None (design contract; prefer after T3 for shape parity)  
**Reuses**: Existing `ReviewSessionStatus`, item report types  
**Requirement**: SSHIST-01, SSHIST-04, SSHIST-08, SSHIST-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Types exported and used nowhere yet without TS errors
- [ ] Gate: `bun run check-types` (cwd `frontend/`)

**Tests**: none  
**Gate**: quick (`check-types`)  

**Commit**: `feat(study): add review session history types`

---

### T6: `reviewSessionsApi.list`

**What**: Client method `list(token, { status, page?, limit? })` → `ListReviewSessionsResponse`.  
**Where**: `frontend/src/lib/api/review-sessions.ts`  
**Depends on**: T5  
**Reuses**: `apiRequest`, existing `getById` patterns  
**Requirement**: SSHIST-01, SSHIST-08, SSHIST-18

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Query string built with `URLSearchParams`
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add review sessions list API client`

---

### T7: Query keys + list / open hooks

**What**: Add list query keys; `useReviewSessionsInfinite` (completed, limit 10); `useOpenReviewSessions` + update `useOpenReviewSession` to prefer API list (newest open).  
**Where**:  
- `frontend/src/lib/query/keys.ts`  
- `frontend/src/lib/query/hooks/use-review-sessions-list.ts` (new)  
- `frontend/src/lib/query/hooks/use-open-review-sessions.ts` (new)  
- `frontend/src/lib/query/hooks/use-open-review-session.ts` (modify)  
**Depends on**: T6  
**Reuses**: `useReviewSession`, `fetchWithAuth`, TanStack `useInfiniteQuery` / `useQuery`  
**Requirement**: SSHIST-08, SSHIST-09, SSHIST-17, SSHIST-18, SSHIST-DES-02, SSHIST-DES-03

**Tools**:
- MCP: `user-context7` (TanStack Query infinite API, if needed)
- Skill: `context7-mcp` (optional)

**Done when**:
- [ ] Infinite query uses `pageParam`, `hasMore` → `hasNextPage`
- [ ] Open hook uses `status=in_progress,pending_review`; banner source is list (storage non-authoritative)
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add review session list and open-session hooks`

---

### T8: `turnsToDisplayMessages` [P]

**What**: Pure mapper from session items + turns → `ReviewDisplayMessage[]` with stable ids and topic dividers.  
**Where**: `frontend/src/features/study/lib/turns-to-display-messages.ts`  
**Depends on**: T5  
**Reuses**: `appendTopicDivider` / message kinds from `review-display-messages.ts` (or inline same shape)  
**Requirement**: SSHIST-13, SSHIST-DES-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Order: per item divider → AI question → human answer for each turn
- [ ] Stable ids (no `crypto.randomUUID` in mapper)
- [ ] Gate: `bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): map review session turns to display messages`

---

### T9: `StudyHistoryRow` [P]

**What**: Sidebar row UI — topics summary, date, Completed badge, active highlight.  
**Where**: `frontend/src/features/study/study-history-row.tsx`  
**Depends on**: T5  
**Reuses**: Practice sidebar row styling (`practice/page.tsx`)  
**Requirement**: SSHIST-08, SSHIST-DES-09, SSHIST-DES-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Props: summary + `isActive` + `onSelect`
- [ ] Topics truncated; date uses `completedAt` ?? `createdAt`
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add study history row`

---

### T10: `StudyHistorySidebar` [P]

**What**: Completed history list + Load more + empty/error states.  
**Where**: `frontend/src/features/study/study-history-sidebar.tsx`  
**Depends on**: T4, T7, T9  
**Reuses**: `AppEmptyState`, `StudyHistoryRow`  
**Requirement**: SSHIST-05–11

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Loads completed infinite list; Load more when `hasNextPage`
- [ ] Click calls `onSelectSession(id)` (or router push — shell may own navigation)
- [ ] Empty + error states
- [ ] Gate: `bun run lint && bun run check-types`
- [ ] Manual verify against live T4 API when available

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add study history sidebar`

---

### T11: `StudySessionTranscript` [P]

**What**: Read-only transcript panel from `GET /:id` turns; loading/error/empty turns.  
**Where**: `frontend/src/features/study/study-session-transcript.tsx`  
**Depends on**: T4, T7, T8  
**Reuses**: `useReviewSession`, `InterviewMessageList` / bubbles, `turnsToDisplayMessages`  
**Requirement**: SSHIST-12–13, SSHIST-16

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] No composer / no stream
- [ ] Optional back control clears selection (callback or `router.push("/study")`)
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add read-only study session transcript`

---

### T12: `StudyHubShell` + `/study` page wiring

**What**: Practice-like shell; `sessionId` search param; redirects for open statuses; panel switch hub vs transcript.  
**Where**:  
- `frontend/src/features/study/study-hub-shell.tsx` (new)  
- `frontend/src/app/(app)/study/page.tsx` ( Suspense + shell )  
- `frontend/src/features/study/study-hub-content.tsx` (nest in main panel; remove duplicate page chrome if any)  
**Depends on**: T10, T11  
**Reuses**: Practice layout classes; `StudyHubContent`; `StudyResumeBanner` stays in hub panel  
**Requirement**: SSHIST-05–07, SSHIST-12, SSHIST-14–16, SSHIST-DES-07, SSHIST-DES-08, SSHIST-DES-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `/study` → sidebar + Active/Learned hub
- [ ] `/study?sessionId=` completed → transcript + highlighted row
- [ ] Open status → `replace` to `/review-session/...` or report
- [ ] 404 → clear param + toast + hub
- [ ] Mobile stack usable
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): add practice-like study hub shell with history`

---

### T13: Banner API source + apply list invalidation

**What**: Ensure resume banner uses open-list hook; invalidate `["review-sessions", "list"]` on successful apply (and clear storage when completed).  
**Where**:  
- `frontend/src/features/study/study-resume-banner.tsx` (if still needed)  
- `frontend/src/features/study/review-session-report.tsx` (invalidate keys)  
- possibly `review-session-chat.tsx` if apply/complete paths exist elsewhere  
**Depends on**: T7, T12  
**Reuses**: `queryKeys` / list key prefix from T7  
**Requirement**: SSHIST-11, SSHIST-17–19, SSHIST-DES-03, SSHIST-DES-13

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Banner does not require `sessionStorage` to show an open session returned by API
- [ ] After Apply → history query invalidated; new completed row appears on `/study`
- [ ] Gate: `bun run lint && bun run check-types`

**Tests**: none  
**Gate**: quick  

**Commit**: `feat(study): wire resume banner and history invalidation to list API`

---

### T14: Frontend build gate + parent doc note

**What**: Full FE build; note in Study Hub design that `STUDY-DES-02` / `BE-STUDY-02` superseded by this feature.  
**Where**: `frontend/` build; optionally one-line update in `study-hub-review-sessions/design.md`  
**Depends on**: T13  
**Reuses**: N/A  
**Requirement**: Success criteria / supersedes section

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `bun run lint && bun run check-types && bun run build` passes in `frontend/`
- [ ] Parent design notes list API required / storage-only banner superseded (brief)

**Tests**: none  
**Gate**: build  

**Commit**: `chore(study): verify study session history build and doc supersession`

---

## Parallel Execution Map

```
Phase 1 (Backend):
  T1 [P] ──┐
  T2 [P] ──┼──→ T3 ──→ T4
  (T2 integration not parallel-safe with other Docker suites — run alone)

Phase 2 (Frontend foundation):
  T5 ──┬──→ T6 ──→ T7
       ├──→ T8 [P]
       └──→ T9 [P]

Phase 3 (UI):
  T10 [P] ──┐
  T11 [P] ──┼──→ T12 ──→ T13 ──→ T14
```

**Orchestrator notes:**
- Do not run T2 integration and T4 e2e in parallel (Docker / DB).
- T10 and T11 may run in parallel after T4+T7+T8/T9.
- Prefer single end-of-feature commit if user requests; otherwise one commit per task as listed.

---

## Pre-Approval Check 1: Granularity

| Task | Scope | Status |
|------|-------|--------|
| T1 | 1 schema (+ colocated unit) | ✅ |
| T2 | 1 repo method (+ integration) | ✅ |
| T3 | 1 service cohesive change (list + turns DTO) | ✅ |
| T4 | Route + controller + e2e + docs (HTTP surface) | ✅ cohesive |
| T5 | 1 types file | ✅ |
| T6 | 1 API method | ✅ |
| T7 | keys + related hooks (one concern: list queries) | ✅ |
| T8 | 1 pure mapper | ✅ |
| T9 | 1 component | ✅ |
| T10 | 1 component | ✅ |
| T11 | 1 component | ✅ |
| T12 | shell + page wiring | ⚠️ 2 files, one UX concern — OK |
| T13 | invalidation + banner source | ⚠️ cohesive integration — OK |
| T14 | build + doc note | ✅ |

---

## Pre-Approval Check 2: Diagram ↔ Depends On

| Task | Depends on (body) | Diagram shows | Status |
|------|-------------------|---------------|--------|
| T1 | None | parallel start | ✅ |
| T2 | None | parallel start | ✅ |
| T3 | T1, T2 | T1+T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | None | Phase 2 start | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T5 | T5 → T8 | ✅ |
| T9 | T5 | T5 → T9 | ✅ |
| T10 | T4, T7, T9 | T4+T7+T9 → T10 | ✅ |
| T11 | T4, T7, T8 | T4+T7+T8 → T11 | ✅ |
| T12 | T10, T11 | T10+T11 → T12 | ✅ |
| T13 | T7, T12 | T12 → T13 (T7 already done) | ✅ |
| T14 | T13 | T13 → T14 | ✅ |

---

## Pre-Approval Check 3: Test Co-location

| Task | Layer | Matrix requires | Task says | Status |
|------|-------|-----------------|-----------|--------|
| T1 | validations | unit | unit | ✅ |
| T2 | repository | integration | integration | ✅ |
| T3 | service | unit | unit | ✅ |
| T4 | routes / controller | e2e (controller none) | e2e | ✅ |
| T5 | types | none | none | ✅ |
| T6 | lib/api | none | none | ✅ |
| T7 | hooks | none | none | ✅ |
| T8 | features/lib | none | none | ✅ |
| T9–T13 | features / app | none | none | ✅ |
| T14 | docs + build | none | none | ✅ |

---

## Requirement Traceability (task mapping)

| Requirement | Tasks |
|-------------|-------|
| SSHIST-01 | T1, T2, T3, T4, T5, T6 |
| SSHIST-02 | T1, T2, T3, T4 |
| SSHIST-03 | T3, T4, T7, T13 |
| SSHIST-04 | T3, T4, T5, T11 |
| SSHIST-05 | T10, T12 |
| SSHIST-06 | T12 |
| SSHIST-07 | T10, T12 |
| SSHIST-08 | T5, T6, T7, T9, T10 |
| SSHIST-09 | T7, T10 |
| SSHIST-10 | T10 |
| SSHIST-11 | T10, T13 |
| SSHIST-12 | T11, T12 |
| SSHIST-13 | T8, T11 |
| SSHIST-14 | T12 |
| SSHIST-15 | T12 |
| SSHIST-16 | T11, T12 |
| SSHIST-17 | T7, T13 |
| SSHIST-18 | T6, T7, T13 |
| SSHIST-19 | T13 |

**Coverage:** 19 total, 19 mapped to tasks, 0 unmapped

---

**Next step:** Approve tasks → **Execute** (ask tools per task / start T1).
