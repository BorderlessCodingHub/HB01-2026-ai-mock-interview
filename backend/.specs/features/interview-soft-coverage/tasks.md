# Interview Soft Coverage — Tasks

**Design**: `backend/.specs/features/interview-soft-coverage/design.md`  
**Spec**: `backend/.specs/features/interview-soft-coverage/spec.md`  
**Context**: `backend/.specs/features/interview-soft-coverage/context.md`  
**Status**: Implemented (T1–T11 complete; commits deferred)

**Test refs**: `backend/docs/TESTING.md`

---

## Execution Plan

### Phase 1: Foundation (Parallel OK)

```
T1 [P] ──┐
T2 [P] ──┼──→ Phase 2 / 3
T4 [P] ──┘
```

### Phase 2: Persistence (Sequential — integration not parallel-safe)

```
T1 → T3
```

### Phase 3: Generators & prompts (Parallel after T2)

```
     ┌→ T5 [P] ─┐
T2 ──┤          ├──→ Phase 4
     └→ T6 [P] ─┘
```

### Phase 4: Services (Parallel after T3+T4+T5)

```
        ┌→ T7 [P] ─┐
T3,T4,T5┤          ├──→ Phase 5
        └→ T8 [P] ─┘
```

### Phase 5: Stream + wiring (Sequential)

```
T6 → T9 → T10 → T11
         ↑
    T4,T7,T8 also feed T10/T11
```

Detailed Phase 5 deps:

```
T6 ──→ T9 ──→ T10 ──→ T11
T4 ────────────┘       ↑
T7 ────────────┘       │
T8 ────────────────────┘
```

---

## Task Breakdown

### T1: Prisma `TopicCoverage` + relations + migration [P]

**What**: Add `TopicCoverage` model and `topicCoverages` relations on `User` and `InterviewSession`; generate client + migration.
**Where**: `backend/prisma/schema/ai-mock-interview.prisma`, `backend/prisma/schema/user.prisma`, `backend/prisma/migrations/*`
**Depends on**: None
**Reuses**: `WeakAnswer` model style in same schema file
**Requirement**: ISC-04, ISC-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Model matches design (`topic`, `angle`, FKs, indexes, `@@map("topic_coverage")`)
- [x] Relations on `User` and `InterviewSession`
- [x] `bun run db:generate` succeeds
- [x] Gate check passes: `bun run check-types` (from `backend/`)

**Tests**: none  
**Gate**: build

**Verify**:
`cd backend && bun run db:generate && bun run check-types`

**Commit**: `feat(interview): add topic_coverage table`

---

### T2: Coverage constants + Zod structured-output schema [P]

**What**: Add `TOPIC_COVERAGE_*` / `ACTIVE_REVIEW_PROMPT_LIMIT` constants and `topicCoverageGeneratorOutputSchema` (`items.max(8)`, topic/angle max lengths).
**Where**: `backend/src/modules/interview/constants/topic-coverage.ts`, `backend/src/modules/interview/validations/interview-schemas.ts`, `interview-schemas.test.ts`
**Depends on**: None
**Reuses**: `reviewItemsGeneratorOutputSchema` / `weakAnswersGeneratorOutputSchema` patterns
**Requirement**: ISC-03, ISC-10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Constants: max per session 8, prompt limit 12, retention 100, active reviews 8
- [x] Schema accepts empty `items`, rejects >8, trims/min-length on topic/angle
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/validations/interview-schemas.test.ts`
- [x] Test count: existing schema tests + ≥4 new cases (no silent deletions)

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/validations/interview-schemas.test.ts`

**Commit**: `feat(interview): add topic coverage output schema`

---

### T3: `TopicCoverageRepository` + integration tests

**What**: Implement `createMany`, `listRecentByUserId`, `countBySessionId`, `pruneOldestBeyondLimit` against Postgres.
**Where**: `backend/src/modules/interview/repository/topic-coverage-repository.ts`, `topic-coverage-repository.integration.test.ts`, record type as needed
**Depends on**: T1
**Reuses**: `weak-answer-repository.ts` / review repo integration helpers (`resetDatabase`)
**Requirement**: ISC-05, ISC-11, ISC-12, ISC-13, ISC-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Append-only `createMany` persists topic+angle for user/session
- [x] `listRecentByUserId` returns newest-first with `take: limit`
- [x] `countBySessionId` supports idempotency checks
- [x] `pruneOldestBeyondLimit(userId, 100)` keeps newest 100 only for that user
- [x] Gate check passes: `bun run test:integration -- src/modules/interview/repository/topic-coverage-repository.integration.test.ts`
- [x] Test count: ≥4 integration cases

**Tests**: integration  
**Gate**: full

**Verify**:
`cd backend && bun run test:integration -- src/modules/interview/repository/topic-coverage-repository.integration.test.ts`

**Commit**: `feat(interview): add TopicCoverageRepository`

---

### T4: Coverage-extraction queue protocol + BullMQ infra [P]

**What**: Add `ICoverageExtractionQueue` and `coverage-extraction-queue.ts` (`jobId=sessionId`, attempts 3, exponential backoff 2000, shared `redisConnection`).
**Where**: `backend/src/modules/interview/protocols/coverage-extraction-queue.ts`, `backend/src/infrastructure/queue/coverage-extraction-queue.ts`
**Depends on**: None
**Reuses**: `weak-answer-queue.ts`, `review-generation-queue.ts`
**Requirement**: ISC-01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `add({ sessionId })` uses design job options / queue name `coverage-extraction`
- [x] No `remove` in MVP protocol
- [x] Gate check passes: `bun run check-types`

**Tests**: none (thin BullMQ wrapper — same as weak-answer queue)  
**Gate**: build

**Verify**:
`cd backend && bun run check-types`

**Commit**: `feat(queue): add coverage-extraction BullMQ queue`

---

### T5: Topic-coverage generator prompt + node + adapter + protocol [P]

**What**: Implement `ITopicCoverageGenerator`, prompt builder, LangGraph structured-output node, and adapter mirroring weak-answers generator.
**Where**: `backend/src/modules/interview/protocols/topic-coverage-generator.ts`, `prompts/topic-coverage-generator-prompt.ts`, `prompts/topic-coverage-generator-prompt.test.ts`, `infrastructure/ai/langgraph/nodes/topic-coverage-generator-node.ts`, `infrastructure/ai/langgraph/topic-coverage-generator-adapter.ts`
**Depends on**: T2
**Reuses**: `weak-answers-generator-node.ts`, `weak-answers-generator-adapter.ts`, `weak-answers-generator-prompt.ts`
**Requirement**: ISC-02, ISC-03, ISC-06, ISC-10

**Tools**:

- MCP: NONE
- Skill: NONE (optional context7 if checking LangChain structured output — not required)

**Done when**:

- [x] Prompt instructs ≤8 free-text topic+angle pairs from transcript; locale-aware strings
- [x] Node uses `withStructuredOutput(topicCoverageGeneratorOutputSchema)` + `{prompt}` template
- [x] Adapter implements protocol and returns `{ items }`
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/prompts/topic-coverage-generator-prompt.test.ts`
- [x] Test count: ≥3 prompt unit tests

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/prompts/topic-coverage-generator-prompt.test.ts`

**Commit**: `feat(interview): add topic coverage LLM generator`

---

### T6: Soft-coverage section in interviewer system prompt [P]

**What**: Add `## Prior coverage (soft guidance)` builder; omit when both lists empty; include normative soft rules from design.
**Where**: `backend/src/modules/interview/prompts/interviewer-system-prompt.ts`, `interviewer-system-prompt.test.ts` (create or extend)
**Depends on**: T2
**Reuses**: Existing section-header pattern in `interviewer-system-prompt.ts`
**Requirement**: ISC-17, ISC-18, ISC-19, ISC-20, ISC-22, ISC-23

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Section omitted when coverage and reviews empty
- [x] Partial lists render correctly
- [x] Instructions cover: avoid same topic+angle; weak = different angle / no Study drill; strong = lower priority
- [x] Description truncation (~120 chars) if descriptions included
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/prompts/interviewer-system-prompt.test.ts`
- [x] Test count: ≥4 new/updated cases

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/prompts/interviewer-system-prompt.test.ts`

**Commit**: `feat(interview): soft-guide interviewer with prior coverage`

---

### T7: `SoftCoveragePromptLoader` + unit tests [P]

**What**: Load ≤12 recent coverage rows + ≤8 active review items (priority high→medium→low) for prompt injection.
**Where**: `backend/src/modules/interview/service/soft-coverage-prompt-loader.ts`, `soft-coverage-prompt-loader.test.ts`
**Depends on**: T3
**Reuses**: `ReviewRepository.listByUserId` + in-memory `status === "active"` filter; `TopicCoverageRepository.listRecentByUserId`
**Requirement**: ISC-15, ISC-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Caps enforced via constants from T2
- [x] Active-only reviews; learned excluded
- [x] Priority sort then take 8
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/service/soft-coverage-prompt-loader.test.ts`
- [x] Test count: ≥4 unit tests

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/service/soft-coverage-prompt-loader.test.ts`

**Commit**: `feat(interview): load soft coverage hints for practice`

---

### T8: `CoverageExtractionService` + unit tests [P]

**What**: Implement `process(sessionId)` — skip paths, idempotency, generate, createMany, prune K=100, token assert/usage; rethrow transient LLM errors.
**Where**: `backend/src/modules/interview/service/coverage-extraction-service.ts`, `coverage-extraction-service.test.ts`
**Depends on**: T3, T4, T5
**Reuses**: `WeakAnswerGenerationService.process` skeleton; `TokenUsageService` + usage callback
**Requirement**: ISC-02, ISC-06, ISC-07, ISC-11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Skip: not_found / not_finished / already_processed
- [x] Token limit → skip/log without throwing (no undo of finish)
- [x] Success path: generate → createMany → prune → `ready`
- [x] Empty items still succeeds (no fake rows)
- [x] Transient generator errors rethrown for BullMQ retry
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/service/coverage-extraction-service.test.ts`
- [x] Test count: ≥6 unit tests

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/service/coverage-extraction-service.test.ts`

**Commit**: `feat(interview): add CoverageExtractionService`

---

### T9: Graph state + interviewer node soft-hint wiring

**What**: Extend interview graph state/input with `recentCoverage` + `activeReviewTopics`; pass into `buildInterviewerSystemPrompt`; omit on closing (`runReview`).
**Where**: `backend/src/infrastructure/ai/langgraph/interview-state.ts`, `nodes/interviewer-node.ts`, related types; unit tests if node/prompt wiring is testable (extend interviewer prompt tests or node test)
**Depends on**: T6
**Reuses**: Existing `InterviewGraphStateAnnotation` field pattern
**Requirement**: ISC-21, ISC-22

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] State fields exist and flow to interviewer prompt builder
- [x] Closing path does not include soft-coverage section
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/prompts/interviewer-system-prompt.test.ts`
- [x] Test count: prior T6 tests still pass; add ≥1 case proving closing omits block if applicable

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run check-types && bun run test -- src/modules/interview/prompts/interviewer-system-prompt.test.ts`

**Commit**: `feat(interview): pass soft coverage into interview graph state`

---

### T10: Wire soft hints + coverage enqueue in `InterviewStreamService`

**What**: Each turn load soft hints and pass to graph; on final turn enqueue coverage job (best-effort log on fail, after weak-answer enqueue).
**Where**: `backend/src/modules/interview/service/stream-service.ts`, `stream-service.test.ts`, `factories/interview/stream-service-factory.ts`
**Depends on**: T4, T7, T9
**Reuses**: Weak-answer enqueue try/catch pattern in same finish block
**Requirement**: ISC-01, ISC-08, ISC-09, ISC-15, ISC-21

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Mid-turn does not enqueue coverage
- [x] Final turn enqueues coverage; enqueue failure logs and still finishes
- [x] Soft hints loaded each turn and passed to `streamMessages`
- [x] Soft-hint load failure degrades to empty hints (interview continues)
- [x] Factory injects queue + loader
- [x] Gate check passes: `bun run lint && bun run check-types && bun run test -- src/modules/interview/service/stream-service.test.ts`
- [x] Test count: existing stream tests + ≥3 new cases (no silent deletions)

**Tests**: unit  
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/interview/service/stream-service.test.ts`

**Commit**: `feat(interview): enqueue coverage extraction and inject soft hints`

---

### T11: Coverage extraction factory + worker registration

**What**: Add `makeCoverageExtractionService()` and register BullMQ worker in `worker.ts` (concurrency 1; log ready/skipped; exhausted failure → structured log with `sessionId`).
**Where**: `backend/src/factories/interview/coverage-extraction-service-factory.ts`, `backend/src/worker.ts`
**Depends on**: T8, T10
**Reuses**: Weak-answer worker registration block in `worker.ts`
**Requirement**: ISC-01, ISC-07, ISC-24, ISC-25

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Factory wires repos + generator adapter + token usage
- [x] Worker processes `coverage-extraction` jobs via `CoverageExtractionService.process`
- [x] Exhausted failure logs `sessionId` (no DB status column; no FE contract)
- [x] Gate check passes: `bun run lint && bun run check-types`

**Tests**: none (thin wiring — covered by T8 unit + T10 stream; same as weak-answer worker registration)  
**Gate**: build

**Verify**:
`cd backend && bun run lint && bun run check-types`

**Commit**: `feat(worker): process coverage-extraction jobs`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1 [P] Prisma
  ├── T2 [P] Constants + Zod
  └── T4 [P] Queue

Phase 2 (Sequential — integration):
  T1 → T3 repository

Phase 3 (Parallel after T2):
  ├── T5 [P] Generator stack
  └── T6 [P] Soft prompt section

Phase 4 (Parallel after T3+T4+T5):
  ├── T7 [P] SoftCoveragePromptLoader
  └── T8 [P] CoverageExtractionService

Phase 5 (Sequential):
  T6 → T9 → T10 → T11
  (T10 also needs T4,T7; T11 also needs T8)
```

**Parallelism notes**:

- Integration (T3) is **not** `[P]` — Testcontainers suite uses shared DB (`fileParallelism: false`).
- Unit-test tasks may run in parallel when deps are met.
- Do not parallelize T9/T10/T11 — shared stream/graph/worker files.

---

## Pre-approval Validation

### Check 1: Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 Prisma model | 1 schema change + migration | ✅ |
| T2 Constants + Zod | Cohesive validation layer | ✅ |
| T3 Repository | 1 repository + integration tests | ✅ |
| T4 Queue wrapper | Protocol + infra file | ✅ |
| T5 Generator stack | One generator pipeline (prompt/node/adapter/protocol) | ✅ cohesive |
| T6 Soft prompt section | 1 prompt module change | ✅ |
| T7 Loader service | 1 service + unit tests | ✅ |
| T8 Extraction service | 1 service + unit tests | ✅ |
| T9 Graph/node wiring | State + node pass-through | ✅ |
| T10 Stream service | Finish enqueue + hint inject | ✅ |
| T11 Factory + worker | Wiring only | ✅ |

### Check 2: Diagram–Definition Cross-Check

| Task | Depends on (body) | Diagram shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ |
| T2 | None | Phase 1 root | ✅ |
| T3 | T1 | T1 → T3 | ✅ |
| T4 | None | Phase 1 root | ✅ |
| T5 | T2 | T2 → T5 | ✅ |
| T6 | T2 | T2 → T6 | ✅ |
| T7 | T3 | T3 → T7 | ✅ |
| T8 | T3, T4, T5 | T3/T4/T5 → T8 | ✅ |
| T9 | T6 | T6 → T9 | ✅ |
| T10 | T4, T7, T9 | T4/T7/T9 → T10 | ✅ |
| T11 | T8, T10 | T8/T10 → T11 | ✅ |

### Check 3: Test Co-location Validation

| Task | Code layer | Matrix requires | Task says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | Prisma schema | none | none | ✅ |
| T2 | validations/ | unit | unit | ✅ |
| T3 | repository/ | integration | integration | ✅ |
| T4 | thin queue wrapper | none | none | ✅ |
| T5 | prompts/ (+ thin node/adapter) | unit | unit | ✅ |
| T6 | prompts/ | unit | unit | ✅ |
| T7 | service/ | unit | unit | ✅ |
| T8 | service/ | unit | unit | ✅ |
| T9 | prompts/graph helpers | unit | unit | ✅ |
| T10 | service/ | unit | unit | ✅ |
| T11 | factory/worker wiring | none | none | ✅ |

No new HTTP routes → no E2E task required for MVP.

---

## Requirement Traceability (Tasks)

| Requirement IDs | Tasks |
| --------------- | ----- |
| ISC-01, ISC-08, ISC-09 | T4, T10, T11 |
| ISC-02–ISC-07, ISC-10 | T2, T5, T8 |
| ISC-11–ISC-14 | T3, T8 |
| ISC-15–ISC-23 | T6, T7, T9, T10 |
| ISC-24–ISC-25 | T11 |

**Coverage:** 25 requirements mapped; 0 unmapped.
