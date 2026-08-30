# Review Session Recap — Tasks

**Design**: `.specs/features/review-session-recap/design.md`  
**Spec**: `.specs/features/review-session-recap/spec.md`  
**Context**: `.specs/features/review-session-recap/context.md`  
**Status**: Validated 2026-08-29 (automated gates green; interactive UAT pending — login + local migration)

**Test refs**: `backend/docs/TESTING.md`, `frontend/.specs/codebase/TESTING.md`

---

## Execution Plan

### Phase 1: Persistence + eval contract (unit `[P]`; integration not `[P]`)

```
T2 [P] ──┐
T3 [P] ──┼──→ T4 [P]
T1 ──────┘
T10 [P]  (FE helper, no BE dep)
T11 [P]  (FE copy, no BE dep)
```

T1 (integration) may run **alongside** T2/T3 in different agents; do not run two Docker integration suites at once.

### Phase 2: Stream + GET (unit `[P]`)

```
T1, T2 ──→ T5 [P]
T1 ──────→ T6 [P]
T2, T3 ──→ T4 [P]
```

### Phase 3: Contract docs + E2E

```
T5, T6 ──→ T7 [P]
T1, T5, T6 ──→ T8
```

T8 is **not** `[P]` (E2E / Docker).

### Phase 4: Frontend (after T6)

```
T6 ──→ T9 ──┬──→ T12 ──┐
            ├──→ T13 ──┼──→ T15 ──→ T16
            └──→ T14   └──→ T17 ──→ T18
T10 ──────────→ T14
T11 ──────────→ T13
```

T13 and T14 are `[P]` after their deps. T15 and T17 are `[P]` after T13.

---

## Task Breakdown

### T1: Prisma recap columns + `saveSuggestions`

**What**: Add `wentWell` / `workOn` `String[]` `@default([])` on `ReviewSessionItem`; map on read; persist in `saveSuggestions` (null → empty arrays); require the fields on `ReviewSessionItemRecord` and default them on existing test helpers so `check-types` passes.
**Where**: `backend/prisma/schema/ai-mock-interview.prisma`, new migration under `backend/prisma/migrations/`, `backend/src/modules/review-sessions/types/review-session-record.ts`, `backend/src/modules/review-sessions/repository/review-session-repository.ts`, `backend/src/modules/review-sessions/repository/review-session-repository.integration.test.ts`, `createSessionItem` / item factories in `review-session-stream-service.test.ts` and `review-sessions-service.test.ts`
**Depends on**: None
**Reuses**: Existing `saveSuggestions` / `toReviewSessionItemRecord`; `turns` Json default pattern (arrays use `String[]` per RSR-DES-02)
**Requirement**: RSR-08, RSR-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Prisma fields `wentWell` / `workOn` map to `went_well` / `work_on`, default `[]`
- [x] `prisma generate` + migration exist; `ReviewSessionItemRecord` includes `wentWell: string[]` and `workOn: string[]`
- [x] `saveSuggestions(id, suggestion)` writes recap; `saveSuggestions(id, null)` writes `[]` and nulls status/priority
- [x] `ReviewSessionSuggestion` may treat recap as optional at the call site (`?? []` in the repository) so T5 can land next without a compile break
- [x] Record factories in stream + sessions service tests default recap to `[]`
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test:integration -- src/modules/review-sessions/repository/review-session-repository.integration.test.ts`
- [x] Test count: existing repository integration suite still passes + recap round-trip and null-clear cases (no silent deletions)

**Tests**: integration
**Gate**: full (integration)

**Verify**:
`cd backend && bun run test:integration -- src/modules/review-sessions/repository/review-session-repository.integration.test.ts`

**Commit**: `feat(review-sessions): persist recap bullets on session items`

---

### T2: Evaluation schema + `normalizeReviewSessionEvaluation` [P]

**What**: Extend `reviewSessionEvaluationOutputSchema` with `wentWell` / `workOn` default `[]`; add `normalizeReviewSessionEvaluation` (trim, drop empty, max 4 bullets, max 180 chars).
**Where**: `backend/src/modules/review-sessions/validations/review-session-schemas.ts`, `backend/src/modules/review-sessions/validations/review-session-schemas.test.ts`
**Depends on**: None
**Reuses**: Existing flat object + `superRefine` status/priority rules (RSR-DES-03, RSR-DES-04)
**Requirement**: RSR-08, RSR-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Existing parses of `{ status, priority }` still succeed (recap defaults to `[]`)
- [x] Status/priority `superRefine` still fail-closed
- [x] Normalize: 5 bullets → 4; 181-char bullet → 180; blanks dropped
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/validations/review-session-schemas.test.ts`
- [x] Test count: existing schema suite still passes + ≥4 recap/normalize cases (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/review-sessions/validations/review-session-schemas.test.ts`

**Commit**: `feat(review-sessions): add recap fields to evaluation schema`

---

### T3: Evaluation prompt recap instructions [P]

**What**: Extend evaluation prompt instructions for `wentWell` / `workOn` (0–4, never invent, grounded in turns, no markdown); locale block stays last.
**Where**: `backend/src/modules/review-sessions/prompts/review-session-evaluation-prompt.ts`, `backend/src/modules/review-sessions/prompts/review-session-evaluation-prompt.test.ts`
**Depends on**: None
**Reuses**: Existing instructions + `buildInterviewLocalePromptBlock`
**Requirement**: RSR-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Instructions mention `wentWell`, `workOn`, empty arrays, and **never invent**
- [x] Status/priority rules unchanged; locale section still last
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/prompts/review-session-evaluation-prompt.test.ts`
- [x] Test count: existing prompt suite still passes + recap-instruction assertions (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/review-sessions/prompts/review-session-evaluation-prompt.test.ts`

**Commit**: `feat(review-sessions): instruct evaluation recap bullets`

---

### T4: Evaluation node parse + normalize [P]

**What**: After `schema.parse(raw)`, return `normalizeReviewSessionEvaluation(...)`.
**Where**: `backend/src/infrastructure/ai/langgraph/nodes/review-session-evaluation-node.ts`, `backend/src/infrastructure/ai/langgraph/nodes/review-session-evaluation-node.test.ts`
**Depends on**: T2, T3
**Reuses**: Existing `{prompt}` template + `withStructuredOutput` pattern
**Requirement**: RSR-08, RSR-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Node output always has clamped `wentWell` / `workOn` arrays
- [x] Malformed status/priority still throws; missing recap keys become `[]`
- [x] Over-cap recap from the model is clamped, not a thrown eval failure
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/infrastructure/ai/langgraph/nodes/review-session-evaluation-node.test.ts`
- [x] Test count: existing node suite still passes + normalize/default cases (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/infrastructure/ai/langgraph/nodes/review-session-evaluation-node.test.ts`

**Commit**: `feat(review-sessions): normalize evaluation recap output`

---

### T5: Stream `evaluating` meta + recap on report [P]

**What**: First SSE event on the evaluation path is `{ status: "evaluating" }`; `toSuggestion` / stream `toReportItem` include recap (`?? []`); final `pending_review` meta includes `interviewLocale` and recap on each report row.
**Where**: `backend/src/modules/review-sessions/service/review-session-stream-service.ts`, `backend/src/modules/review-sessions/service/review-session-stream-service.test.ts`
**Depends on**: T1, T2
**Reuses**: `runEvaluation`, `writeEvent`, existing abort checks (RSR-DES-01, RSR-DES-07, RSR-DES-14)
**Requirement**: RSR-01, RSR-10, RSR-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Last-turn stream tests: first meta is `evaluating`; later meta is `pending_review` with `interviewLocale` and `wentWell`/`workOn`
- [x] Failed item: empty recap arrays + null suggestions (existing error event kept)
- [x] Non-last turns unchanged (tokens + in_progress meta)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/service/review-session-stream-service.test.ts`
- [x] Test count: existing stream suite still passes + evaluating/recap assertions (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/review-sessions/service/review-session-stream-service.test.ts`

**Commit**: `feat(review-sessions): emit evaluating meta and recap report`

---

### T6: GET/apply report includes locale + recap [P]

**What**: `toReport` / `ReviewSessionReport` include `interviewLocale` and per-item `wentWell` / `workOn`. Create/list payloads unchanged.
**Where**: `backend/src/modules/review-sessions/service/review-sessions-service.ts`, `backend/src/modules/review-sessions/service/review-sessions-service.test.ts`
**Depends on**: T1
**Reuses**: Existing `toReport` / `toReportItem` (RSR-DES-14)
**Requirement**: RSR-10, RSR-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `getById` (and apply 200) include `interviewLocale` and recap arrays
- [x] `list` / `create` response shapes unchanged
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/review-sessions/service/review-sessions-service.test.ts`
- [x] Test count: existing service suite still passes + locale/recap assertions (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/review-sessions/service/review-sessions-service.test.ts`

**Commit**: `feat(review-sessions): expose recap and locale on session GET`

---

### T7: API doc recap contract [P]

**What**: Document evaluating meta, `pending_review` `interviewLocale` + recap fields, and GET `interviewLocale` / `wentWell` / `workOn`.
**Where**: `backend/docs/frontend-mock-interview-api.md`
**Depends on**: T5, T6
**Reuses**: Existing review-sessions SSE / GET sections
**Requirement**: RSR-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Last-turn SSE documents `evaluating` then `pending_review` with recap
- [x] GET example includes `interviewLocale` and recap arrays
- [x] Apply body unchanged
- [x] Gate check passes: docs-only (no test runner); skim the review-sessions section for accuracy
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
Search the doc for `evaluating`, `wentWell`, `interviewLocale` under review-sessions.

**Commit**: `docs(api): document review session recap contract`

---

### T8: Review-sessions E2E recap + evaluating

**What**: Mock `evaluate` returns recap; last stream contains `evaluating` then `pending_review`; GET after eval includes `interviewLocale` + bullets; failed eval item has empty arrays. Existing lifecycle/apply assertions still pass.
**Where**: `backend/src/test/e2e/review-sessions.e2e.test.ts`
**Depends on**: T1, T5, T6
**Reuses**: `runStreamThroughEvaluation`, `configureReviewSessionAiMocks`, `QUESTION_COUNT: 1`
**Requirement**: RSR-09, RSR-10, RSR-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Last-answer SSE text includes `"evaluating"` and `"pending_review"`
- [x] GET `pending_review` body has `interviewLocale` and `wentWell`/`workOn` on succeeded items
- [x] Failure-path item (if covered) has `[]` recap; apply still 200
- [x] Gate check passes: `cd backend && bun run test:e2e -- src/test/e2e/review-sessions.e2e.test.ts`
- [x] Test count: existing E2E suite still passes + recap/evaluating assertions (no silent deletions)

**Tests**: e2e
**Gate**: full

**Verify**:
`cd backend && bun run test:e2e -- src/test/e2e/review-sessions.e2e.test.ts`

**Commit**: `test(review-sessions): assert recap payload and evaluating SSE`

---

### T9: Frontend review-session types

**What**: Add `interviewLocale`, item `wentWell`/`workOn`, `ReviewSessionStreamMetaEvaluating`, and recap + locale on `pending_review` meta.
**Where**: `frontend/src/types/review-sessions.ts`
**Depends on**: T6
**Reuses**: Existing `ReviewSession` / stream meta union
**Requirement**: RSR-10, RSR-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `ReviewSession` includes `interviewLocale`
- [x] Item report includes `wentWell: string[]` and `workOn: string[]`
- [x] Stream meta union is progress \| evaluating \| complete
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A (frontend matrix: types not a tested layer)

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): type review session recap and evaluating meta`

---

### T10: `isLastReviewAnswer` [P]

**What**: Pure helper: last answer iff `itemIndex === totalItems - 1 && turnsCompleted + 1 === questionsPerItem`.
**Where**: `frontend/src/features/study/lib/is-last-review-answer.ts`
**Depends on**: None
**Reuses**: `ReviewSessionStreamMetaProgress` fields (import types if needed; may use a minimal param type to avoid waiting on T9)
**Requirement**: RSR-01, RSR-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Helper matches RSR-DES-01 client rule
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A — **do not** add `*.test.ts` (frontend TESTING.md: none)

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): detect last review-session answer`

---

### T11: Recap heading copy [P]

**What**: `getReviewRecapHeadings(locale)` returns Practice headings without `## ` (EN/PT per RSR-DES-10).
**Where**: `frontend/src/features/study/lib/review-recap-copy.ts`
**Depends on**: None
**Reuses**: Meaning of `getClosingFeedbackCopy` (do not import backend)
**Requirement**: RSR-05, RSR-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `en`: “What went well” / “What to work on”
- [x] `pt`: “O que você fez bem” / “O que precisa trabalhar”
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): add review recap section headings`

---

### T12: `deriveReviewResultsSummary`

**What**: Pure helper counting topics, learned, and priority changes for `suggested` | `confirmed` (RSR-DES-11).
**Where**: `frontend/src/features/study/lib/derive-review-results-summary.ts`
**Depends on**: T9
**Reuses**: `ReviewSessionItemReport`
**Requirement**: RSR-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `learnedCount` / `priorityChangeCount` match design (null status ≠ learned; learned ≠ priority change)
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): derive review results summary counts`

---

### T13: `ReviewTopicRecap` [P]

**What**: Recap sections with locale headings; omit empty arrays; render nothing when `evaluationFailed`.
**Where**: `frontend/src/features/study/review-topic-recap.tsx`
**Depends on**: T9, T11
**Reuses**: T11 headings; existing card typography tokens
**Requirement**: RSR-05, RSR-06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Empty `wentWell` or `workOn` omits that section (no invented fallback)
- [x] `evaluationFailed` → null render
- [x] Bullets are `<ul>`, not markdown
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): render per-topic recap bullets`

---

### T14: Chat evaluating wait [P]

**What**: Last answer or SSE `evaluating` shows “Evaluating your answers…” (no typing bubble, composer disabled); `pending_review` seeds cache with recap + locale and navigates without “Redirecting…”; progress meta only when `status === "in_progress"`.
**Where**: `frontend/src/features/study/review-session-chat.tsx`
**Depends on**: T9, T10
**Reuses**: T10; existing `seedReportCache` / `streamReviewSessionTurn` (RSR-DES-01, RSR-DES-12)
**Requirement**: RSR-01, RSR-02, RSR-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `canSend` is false while evaluating
- [x] Evaluating copy uses `role="status"` + spinner; no AI typing bubble
- [x] `seedReportCache` includes `interviewLocale`, `wentWell`, `workOn`
- [x] Non-last answers unchanged
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): show evaluating wait on last review answer`

---

### T15: Report card recap + card state [P]

**What**: `ReportCardState` carries read-only recap; `ReviewReportCard` renders `ReviewTopicRecap` above existing suggestion line and outcome controls. Apply payload unchanged.
**Where**: `frontend/src/features/study/lib/report-card-state.ts`, `frontend/src/features/study/review-report-card.tsx`
**Depends on**: T13
**Reuses**: `initReportCardState`, existing Keep active / learned / priority UI
**Requirement**: RSR-05, RSR-06, RSR-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Recap is above controls; failed eval still shows warning, no recap
- [x] `buildApplyPayload` still has no recap fields
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): show recap on review report cards`

---

### T16: Report page as results

**What**: Title **Review results**, description per RSR-DES-09, derived summary (`suggested`), pass `session.interviewLocale` into cards. Apply / keepalive unchanged.
**Where**: `frontend/src/features/study/review-session-report.tsx`
**Depends on**: T12, T15
**Reuses**: T12; existing Apply / auto-apply
**Requirement**: RSR-03, RSR-04, RSR-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Primary title is not “Review suggestions”
- [x] Summary shows topic / suggested-learned / priority-change counts
- [x] Apply + unmount keepalive still work as today
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): recast review report as session results`

---

### T17: History result card [P]

**What**: Read-only card: topic, `ReviewTopicRecap`, applied outcome (`confirmedStatus` / `confirmedPriority`). No editors, no Apply.
**Where**: `frontend/src/features/study/review-history-result-card.tsx`
**Depends on**: T13
**Reuses**: `ReviewPriorityBadge`; T13
**Requirement**: RSR-12, RSR-13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] No Apply / Keep active / priority `<select>`
- [x] Null `confirmedStatus` omits the outcome line
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] Test count: N/A

**Tests**: none
**Gate**: quick

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(study): add read-only review history result card`

---

### T18: History results above transcript

**What**: `/study?sessionId=` completed view: title **Session results**, derived summary (`confirmed`), T17 cards, then existing transcript. Legacy empty recap omits sections. `StudyHubShell` redirects unchanged.
**Where**: `frontend/src/features/study/study-session-transcript.tsx`
**Depends on**: T12, T17
**Reuses**: Existing Q&A rendering
**Requirement**: RSR-12, RSR-13, RSR-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Results block is above the Q&A; no Results/Transcript tabs
- [x] Headings use session `interviewLocale` (fallback `en` if missing)
- [x] Gate check passes: `cd frontend && bun run lint && bun run check-types && bun run build` (if repo-wide lint hits known `react-hooks/refs` debt, run ESLint on the files this task changed + `check-types` + `build`)
- [x] Test count: N/A

**Tests**: none
**Gate**: build

**Verify**:
`cd frontend && bun run check-types && bun run build`

**Commit**: `feat(study): show recap above completed session transcript`

---

## Parallel Execution Map

```
Phase 1:
  T1 (integration, not [P])
  T2 [P]  T3 [P]  T10 [P]  T11 [P]
  T2+T3 ──→ T4 [P]          (Phase 2)

Phase 2:
  T1+T2 ──→ T5 [P]
  T1    ──→ T6 [P]
  T2+T3 ──→ T4 [P]

Phase 3:
  T5+T6 ──→ T7 [P]
  T1+T5+T6 ──→ T8 (e2e, sequential)

Phase 4:
  T6 ──→ T9 ──┬──→ T12 ──→ T16
              ├──→ T13 [P] ──┬──→ T15 [P] ──→ T16
              │              └──→ T17 [P] ──→ T18
              └──→ T14 [P]
  T10 ──→ T14
  T11 ──→ T13
  T12 ──→ T18
```

---

## Task Granularity Check

| Task | Scope | Status |
|------|--------|--------|
| T1: Prisma + saveSuggestions | 1 persistence slice (schema + repo) | ✅ Granular |
| T2: Evaluation schema + normalize | 1 validation module | ✅ Granular |
| T3: Evaluation prompt | 1 prompt | ✅ Granular |
| T4: Evaluation node | 1 node | ✅ Granular |
| T5: Stream meta + report map | 1 service method path | ✅ Granular |
| T6: GET toReport | 1 mapper | ✅ Granular |
| T7: API doc | 1 doc section | ✅ Granular |
| T8: E2E recap | 1 e2e file | ✅ Granular |
| T9: FE types | 1 types file | ✅ Granular |
| T10: isLastReviewAnswer | 1 function | ✅ Granular |
| T11: Recap copy | 1 function | ✅ Granular |
| T12: Derive summary | 1 function | ✅ Granular |
| T13: ReviewTopicRecap | 1 component | ✅ Granular |
| T14: Chat evaluating | 1 component | ✅ Granular |
| T15: Report card + state | 1 card + its state helper | ✅ Granular (cohesive) |
| T16: Report page | 1 page component | ✅ Granular |
| T17: History result card | 1 component | ✅ Granular |
| T18: Transcript layout | 1 component | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends on (body) | Diagram shows | Status |
|------|-------------------|---------------|--------|
| T1 | None | Phase 1 root | ✅ Match |
| T2 | None | Phase 1 `[P]` | ✅ Match |
| T3 | None | Phase 1 `[P]` | ✅ Match |
| T4 | T2, T3 | T2+T3 → T4 | ✅ Match |
| T5 | T1, T2 | T1+T2 → T5 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T5, T6 | T5+T6 → T7 | ✅ Match |
| T8 | T1, T5, T6 | T1+T5+T6 → T8 | ✅ Match |
| T9 | T6 | T6 → T9 | ✅ Match |
| T10 | None | Phase 1 `[P]` | ✅ Match |
| T11 | None | Phase 1 `[P]` | ✅ Match |
| T12 | T9 | T9 → T12 | ✅ Match |
| T13 | T9, T11 | T9+T11 → T13 | ✅ Match |
| T14 | T9, T10 | T9+T10 → T14 | ✅ Match |
| T15 | T13 | T13 → T15 | ✅ Match |
| T16 | T12, T15 | T12+T15 → T16 | ✅ Match |
| T17 | T13 | T13 → T17 | ✅ Match |
| T18 | T12, T17 | T12+T17 → T18 | ✅ Match |

T4, T5, T6 are `[P]` and do not depend on each other. T13/T14 `[P]` do not depend on each other. T15/T17 `[P]` do not depend on each other.

---

## Test Co-location Validation

| Task | Code layer | Matrix requires | Task says | Status |
|------|------------|-----------------|-----------|--------|
| T1 | `repository/` | integration | integration | ✅ OK |
| T2 | `validations/` | unit | unit | ✅ OK |
| T3 | `prompts/` | unit | unit | ✅ OK |
| T4 | LangGraph helper | unit | unit | ✅ OK |
| T5 | `service/` | unit | unit | ✅ OK |
| T6 | `service/` | unit | unit | ✅ OK |
| T7 | docs | none | none | ✅ OK |
| T8 | HTTP E2E | e2e | e2e | ✅ OK |
| T9 | `src/types/` (FE) | none | none | ✅ OK |
| T10–T18 | `src/features/` (FE) | none | none | ✅ OK |

No test deferral. T1 includes integration tests in the same task as `saveSuggestions`. T8 is the e2e for the HTTP/SSE contract (controller layer = none, covered by E2E).

---

## Requirement Traceability (tasks)

| Requirement | Tasks |
|-------------|-------|
| RSR-01, RSR-02 | T5, T10, T14 |
| RSR-03, RSR-04 | T12, T16 |
| RSR-05, RSR-06 | T11, T13, T15 |
| RSR-07 | T15, T16 |
| RSR-08, RSR-09 | T1, T2, T3, T4 |
| RSR-10, RSR-11 | T5, T6, T7, T8, T9, T14 |
| RSR-12, RSR-13, RSR-14 | T6, T9, T11, T17, T18 |

---

## Next step

Validated 2026-08-29: T1–T18 done; backend lint/types/unit/integration/e2e + frontend build green. Interactive UAT still needed (Borderless login; apply `20260829120000_add_review_session_item_recap` locally first). Commits deferred.
