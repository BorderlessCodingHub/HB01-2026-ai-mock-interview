# Interview Soft Coverage — Specification

## Problem Statement

Each new practice interview (`/practice`, normal mock interview) starts with a fresh LangGraph thread and only résumé + level + optional job description + locale. The interviewer has **no memory of topics and angles already explored** in prior sessions, so candidates often get repetitive questions. That feels massante and wastes turns that could surface new gaps.

The product already separates **discovery** (`/practice`) from **deliberate mastery** (`/study` Review Sessions). Soft coverage must reduce cross-session echo in practice **without** turning practice into a drill on known review items, and **without** dumping full transcripts into the interviewer prompt (cost must stay bounded).

## Goals

- [ ] After each finished practice interview, persist a compact coverage memory of **topic + free-text angle** pairs extracted from that session
- [ ] On the next practice session start, inject a **fixed-budget** soft-guidance block (recent coverage + active review topics) into the interviewer system prompt once per session
- [ ] Prefer exploring under-covered material; if touching a weak (active review) topic, use a **different angle**; strong/already-covered material gets **lower priority** (not a permanent ban)
- [ ] Coverage extraction is **async**, best-effort, and never blocks finishing or starting interviews
- [ ] Prompt token cost for coverage/review hints stays **bounded** regardless of how many past interviews the user has

## Out of Scope

| Item | Reason |
|------|--------|
| Hard exclude / regenerate when question matches recent coverage | Soft-only MVP (P5); add only if soft fails in production |
| Fixed angle enum / taxonomy | Angles are free-text via structured output |
| Embedding / semantic similarity dedup of coverage rows | Overkill for soft guidance; append-only + prompt cap |
| Passing weak-answer snippets or full transcripts into the interviewer | Cost and blurs Practice vs Study |
| UI modes (Explore / Balanced / Pressure) | Single default balanced behavior |
| Study CTA / system-suggested Review Sessions | Separate product feature (already deferred elsewhere) |
| Mutating review item priority/status from practice coverage | Review Sessions + manual PATCH own that lifecycle |
| Frontend UI to browse/edit coverage | Backend/prompt behavior only for MVP |
| Changing Review Session or `/study` flows | Coverage feeds practice only |
| Sync extraction on `createSession` / first turn | Must not add start latency |

---

## Relationship to Existing Features

| Feature | Link | Impact |
|---------|------|--------|
| AI Mock Interview | [ai-mock-interview/spec.md](../ai-mock-interview/spec.md) | Interviewer prompt gains soft coverage block; finish path enqueues coverage job |
| Async Review Items Generation | [async-review-items-generation](../../../../.specs/features/async-review-items-generation/spec.md) | Parallel pattern: dedicated BullMQ queue + worker; coverage is a **separate** job from review generation |
| Review Items Learned Status | [review-items-learned-status/spec.md](../review-items-learned-status/spec.md) | Active review topics (not `learned`) feed the soft prompt; practice still does **not** mutate existing items |
| Study Hub / Review Sessions | frontend study specs | Mastery of weak topics remains on `/study`; this feature only soft-hints practice |

**Brownfield touchpoints:**

| Area | Current state | Change |
|------|---------------|--------|
| Prisma | No coverage table | Add `TopicCoverage` (name finalized in Design) append-only rows |
| `InterviewStreamService` finish path | Enqueues review-generation + weak-answer queues | Also enqueue coverage extraction (best-effort; failure must not undo finish) |
| `buildInterviewerSystemPrompt` / interviewer node | CV, JD, level, locale, conduct | Add soft coverage + active review topics section when lists non-empty |
| Session create / first graph invocation | No historical hints | Load capped lists once into graph/system prompt state |
| Worker (`src/worker.ts`) | Review + weak-answer processors | Register coverage processor |
| Review items list | `status=active` available | Reuse as weak-topic signal (no new weakness enum on coverage) |

---

## Product Rules (normative)

These rules are the behavioral contract for the soft prompt and for how weakness is inferred:

1. **Unit of coverage** = `topic` + `angle` (both short free-text strings). The same topic may reappear if the angle differs.
2. **Weak** = topic appears in the user's **active** review items (and/or is treated as weak via existing backlog — Design may note weak answers are **not** injected as snippets). Mastery of weak topics is **Study's** job; practice may lightly revisit with a **different angle**.
3. **Strong / covered without active gap** = lower priority to ask again; if asked again, prefer a **different angle**. No permanent ban.
4. **Enforcement** = soft guidance in the system prompt only. No post-check regenerate, no hard topic allowlist.
5. **Practice vs Study** = practice remains discovery-first; coverage must not turn the interviewer into a review-item drill.

---

## User Stories

### P1: Extract and persist coverage after a finished interview ⭐ MVP

**User Story**: As the platform, after a practice interview finishes I want a compact list of topics and angles that were covered, so later sessions can avoid repetitive angles without storing full transcripts in the hot path.

**Why P1**: Without persisted coverage there is nothing to inject; this is the memory layer.

**Acceptance Criteria**:

1. WHEN a practice interview session is marked finished on the final turn THEN the system SHALL enqueue an async coverage-extraction job (dedicated queue, same worker process pattern as review generation) containing at least `{ sessionId }`
2. WHEN the coverage job runs THEN it SHALL load the session transcript (and any minimal context needed), call an LLM with **structured output** shaped as a list of `{ topic: string, angle: string }`, and persist the returned items as new coverage rows owned by the session's user and linked to the session
3. WHEN the LLM returns items THEN the system SHALL persist at most **8** pairs for that session (representative coverage; model instructed to pick the most salient ≤8)
4. WHEN persisting THEN each row SHALL store at least: `userId`, `sessionId`, `topic`, `angle`, `createdAt` (exact table/column names in Design)
5. WHEN persisting THEN the system SHALL use **append-only** inserts for that session's extraction (no upsert that collapses multiple angles on the same topic into one row)
6. WHEN the coverage job succeeds with zero items THEN the system SHALL treat that as success (no crash; no fake rows required)
7. WHEN the coverage job fails after retries THEN the system SHALL NOT clear `isFinished` on the interview session and SHALL NOT block future practice starts
8. WHEN enqueue of the coverage job fails after the conversation was finished THEN the interview SHALL remain finished; coverage absence is acceptable (best-effort)
9. WHEN non-final turns complete THEN the system SHALL NOT enqueue coverage extraction
10. `topic` and `angle` SHALL be free-text (no fixed angle enum); Design SHALL define reasonable max lengths and validation for structured output

**Independent Test**: Finish a session → coverage job runs → ≤8 rows appear for that `sessionId`/`userId`. Kill/fail the job → session stays finished; user can still start a new practice.

**Requirement IDs**: `ISC-01` … `ISC-10`

---

### P1: Bound stored coverage per user (retention) ⭐ MVP

**User Story**: As the platform, I want coverage storage not to grow without bound per user, while still keeping enough recent history for soft guidance.

**Why P1**: Append-only without retention eventually bloats DB; prompt already caps what is read, but ops cost still matters.

**Acceptance Criteria**:

1. WHEN new coverage rows are inserted for a user THEN the system SHALL ensure the user retains at most **K** most recent coverage rows (**K = 100** unless Design justifies a different constant)
2. WHEN retention runs THEN older rows beyond K SHALL be deleted (or equivalently pruned) for that user only
3. WHEN retention runs THEN it SHALL NOT affect other users' rows
4. Retention MAY run in the same coverage job after insert or via an equivalent per-user prune; exact mechanism is Design

**Independent Test**: Seed >K rows for a user, run extraction/prune → at most K remain, newest preserved.

**Requirement IDs**: `ISC-11` … `ISC-14`

---

### P1: Soft-guide the next practice interview with capped context ⭐ MVP

**User Story**: As a candidate starting a new practice interview, I want the AI to prefer fresh angles and under-explored areas (and only lightly touch known weaknesses with a new angle), so sessions feel less repetitive without becoming a Study drill.

**Why P1**: This is the user-visible value of the feature.

**Acceptance Criteria**:

1. WHEN a new practice interview session's interviewer system prompt / initial graph state is built THEN the system SHALL load up to the **12** most recent coverage rows for that user (topic + angle + age/recency signal as Design specifies)
2. WHEN building that prompt THEN the system SHALL also load up to **8** of the user's **active** review items (prefer higher priority first) as weak-topic hints (topic + optional short description/priority as Design specifies)
3. WHEN both lists are empty THEN the interviewer prompt SHALL behave as today (résumé + level + optional JD + locale + existing conduct) with no coverage section required
4. WHEN one list is empty and the other is not THEN the system SHALL still inject the non-empty list (partial soft guidance)
5. WHEN the coverage/review soft block is present THEN it SHALL instruct the model to: avoid repeating the **same topic+angle** recently covered; prefer underexplored areas; if touching an active review topic, use a **different angle**; treat well-covered topics without active gaps as **lower priority** (may still ask later with a different angle)
6. WHEN the soft block is present THEN it SHALL NOT instruct the model to drill all active review items or to master weak topics inside practice
7. The soft block SHALL be injected **once per session** into the system prompt / initial graph state so it remains available for later turns via checkpoint — NOT recomputed on every turn
8. Soft guidance SHALL be prompt-only: the system SHALL NOT reject or regenerate interviewer questions based on coverage matching in MVP
9. Prompt construction SHALL keep the soft block within a predictable size consistent with the row caps (12 + 8); Design documents approximate token budget

**Independent Test**: User with recent coverage + active reviews starts a session → system prompt/state includes both capped lists and the behavioral rules. New user with no data → prompt unchanged aside from existing fields. Mid-turn does not re-query coverage DB.

**Requirement IDs**: `ISC-15` … `ISC-23`

---

### P2: Observability for coverage job (ops) 

**User Story**: As an operator, I want to know whether coverage extraction for a session succeeded or failed, so I can debug silent best-effort gaps.

**Why P2**: Not required for candidate UX in MVP; reduces blind spots in production.

**Acceptance Criteria**:

1. WHEN coverage extraction completes or fails THEN the system SHALL leave an inspectable signal (session field, log fields, and/or job result — Design choice) including at least success vs failure and a short error when failed
2. WHEN coverage fails THEN candidate-facing practice APIs SHALL NOT require a new blocking error state (no FE status polling required for MVP)

**Independent Test**: Force worker failure → ops can see failure tied to `sessionId`; GET session for candidates still works without a mandatory new UI state.

**Requirement IDs**: `ISC-24` … `ISC-25`

---

## Edge Cases

- WHEN the user has never finished an interview THEN coverage is empty and practice works as today
- WHEN coverage job is still running while the user starts another practice THEN the new session SHALL use whatever coverage rows exist at start time (no wait)
- WHEN review generation is `pending`/`failed` but older active review items exist THEN those active items SHALL still be injectable
- WHEN `learned` review items exist THEN they SHALL NOT be included in the weak-topic hint list (active only)
- WHEN the LLM returns more than 8 pairs THEN the system SHALL persist at most 8 (truncate or reject extras per Design; prefer schema max)
- WHEN `topic`/`angle` strings are empty or whitespace THEN the system SHALL drop those items
- WHEN two sessions finish close together THEN both jobs MAY append; retention prune keeps ≤K newest
- WHEN the session has no AI questions (degenerate transcript) THEN empty coverage is success
- WHEN locale is `pt` or `en` THEN coverage extraction and soft-block language SHALL follow Design (prefer extracting in interview locale; soft block may be English instructions with localized topic strings as returned)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ISC-01 | P1: Extract coverage (enqueue) | Execute | Verified |
| ISC-02 | P1: Extract coverage (LLM + persist) | Execute | Verified |
| ISC-03 | P1: Extract coverage (max 8) | Execute | Verified |
| ISC-04 | P1: Extract coverage (row shape) | Execute | Verified |
| ISC-05 | P1: Extract coverage (append-only) | Execute | Verified |
| ISC-06 | P1: Extract coverage (empty OK) | Execute | Verified |
| ISC-07 | P1: Extract coverage (fail safe finish) | Execute | Verified |
| ISC-08 | P1: Extract coverage (enqueue fail safe) | Execute | Verified |
| ISC-09 | P1: Extract coverage (final turn only) | Execute | Verified |
| ISC-10 | P1: Extract coverage (free-text + limits) | Execute | Verified |
| ISC-11 | P1: Retention (K=100) | Execute | Verified |
| ISC-12 | P1: Retention (prune oldest) | Execute | Verified |
| ISC-13 | P1: Retention (per-user) | Execute | Verified |
| ISC-14 | P1: Retention (mechanism) | Execute | Verified |
| ISC-15 | P1: Soft guide (12 coverage) | Execute | Verified |
| ISC-16 | P1: Soft guide (8 active reviews) | Execute | Verified |
| ISC-17 | P1: Soft guide (both empty) | Execute | Verified |
| ISC-18 | P1: Soft guide (partial lists) | Execute | Verified |
| ISC-19 | P1: Soft guide (behavioral rules) | Execute | Verified |
| ISC-20 | P1: Soft guide (not a Study drill) | Execute | Verified |
| ISC-21 | P1: Soft guide (once per session) | Execute | Verified* |
| ISC-22 | P1: Soft guide (prompt-only) | Execute | Verified |
| ISC-23 | P1: Soft guide (token budget) | Execute | Verified |
| ISC-24 | P2: Observability signal | Execute | Verified |
| ISC-25 | P2: No blocking FE status | Execute | Verified |

**ID format:** `ISC-[NUMBER]` (Interview Soft Coverage)

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 25 total, 25 mapped to tasks, 0 unmapped

\* **ISC-21 SPEC_DEVIATION:** Spec said inject once per session; approved design loads soft hints every `streamTurn` (résumé pattern / avoid LangGraph empty overwrite). Implemented per design.

---

## Success Criteria

- [ ] Finishing a practice interview reliably enqueues coverage extraction without slowing the final SSE turn beyond existing enqueue patterns
- [ ] A user with prior coverage + active review items gets a soft-guidance block on the next practice session within the 12+8 caps
- [ ] A user with no coverage/reviews experiences no regression in practice start or interview quality
- [ ] Coverage storage per user stays ≤ K (100) rows after prune
- [ ] Practice does not become a review-item drill; Study remains the mastery path
- [ ] No full transcripts of prior sessions are passed into the interviewer prompt for this feature
