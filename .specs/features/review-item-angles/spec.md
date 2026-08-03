# Review Item Angles — Specification

## Problem Statement

Review items today are keyed only by `topic`. When Practice discovers a gap on a different facet of the same subject (e.g. Caching → write-path invalidation vs read-through TTL), merge skips it as a duplicate. Study then reinforces a coarse topic blob instead of the specific probe the candidate missed. Practice also has no signal of which facets were already covered, so interviews tend to rehash the same angles.

## Goals

- [x] Persist an **angle** (specific interview probe/facet) on every review item
- [x] Allow multiple review items per topic when angles differ
- [x] Practice prefers uncovered angles (variety)
- [x] Study Q&A locks to the missed angle (reinforcement)
- [x] Expose `angle` on review-item and review-session APIs and Study UI

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Controlled competency taxonomy / curriculum graph | No taxonomy exists; free-text LLM labels |
| Spaced repetition, streaks, analytics | Separate product features |
| Auto-splitting historical descriptions into many angles | Simple `general` backfill only |
| WeakAnswers schema changes | Separate generator path |
| Separate `topic_coverage` table | `review_items` is the missed-angle ledger |
| Auto-reactivate learned `(topic, angle)` on practice re-hit | Keep insert-skip consistent with today’s topic behavior |

---

## Definition

An **angle** is the specific interview probe/facet that exposed a gap within a subject — e.g. topic `Caching`, angle `write-path invalidation`. It names *how the candidate was tested and where they failed*, not the subject (`topic`) and not the coaching narrative (`description`).

**Mastery:** one `review_items` row = one missed angle. Existing `status` / `learnedAt` track mastery per row.

---

## User Stories

### P1: Persist angle on review items ⭐ MVP

**User Story**: As the platform, I want each review item to store the angle that exposed the gap so that Study and Practice can reason about specific facets, not only topics.

**Why P1**: Foundation for variety and reinforcement.

**Acceptance Criteria**:

1. WHEN a review item is created THEN it SHALL store a non-empty `angle` string
2. WHEN existing rows are migrated THEN they SHALL receive `angle = 'general'` and remain valid
3. WHEN uniqueness is evaluated THEN the system SHALL use `(userId, topic, angle)` not `(userId, topic)` alone
4. WHEN `GET /api/review-items` (and related review-session item payloads) return items THEN each item SHALL include `angle`
5. WHEN a Review Session is created THEN each session item SHALL snapshot `angle` alongside `topic` and `description`

**Independent Test**: Create two items with same topic, different angles → both persist. List API returns `angle`. Session create snapshots `angle`.

---

### P1: Generator emits and merge dedupes by (topic, angle) ⭐ MVP

**User Story**: As a candidate finishing Practice, I want newly discovered facets of a known topic to become review items so my backlog reflects what I actually missed.

**Why P1**: Today’s topic-only skip blocks multi-angle coverage.

**Acceptance Criteria**:

1. WHEN the review-items generator runs THEN each item SHALL include `topic`, `angle`, `description`, and `priority`
2. WHEN the generator sees an existing `(topic, angle)` (exact or similar) THEN it SHALL reuse exact strings when matching (prompt guidance) and merge SHALL skip insert
3. WHEN the generator emits a new `(topic, angle)` with no exact/similar match THEN merge SHALL insert an `active` row
4. WHEN two items share a topic but have meaningfully different angles THEN both SHALL be insertable
5. WHEN similarity dedupe runs THEN it SHALL consider the `(topic, angle)` pair (not topic alone)

**Independent Test**: Seed topic `caching` / angle `ttl`; generate `caching` / `write-path invalidation` → insert. Generate similar angle → skip.

---

### P1: Practice prefers uncovered angles ⭐ MVP

**User Story**: As a candidate in Practice, I want the interviewer to explore facets I have not already covered so each mock interview expands my exposure.

**Why P1**: Product differentiation vs Study reinforcement.

**Acceptance Criteria**:

1. WHEN building the interviewer system prompt THEN the system SHALL include the user’s already-covered angles (active and learned)
2. WHEN covered angles are present THEN the interviewer instructions SHALL prefer new facets and avoid rehashing covered ones (except a brief natural follow-up)
3. WHEN the user has no review items THEN the covered-angles block SHALL be empty/absent without breaking the interview

**Independent Test**: Seed covered angles → interviewer prompt contains them and variety instructions. Empty list → no block / interview still works.

---

### P1: Study reinforces the missed angle ⭐ MVP

**User Story**: As a candidate in Study, I want review Q&A and evaluation scoped to the specific angle I missed so practice reinforces that gap, not the whole subject.

**Why P1**: Completes the study half of the loop.

**Acceptance Criteria**:

1. WHEN a Review Session question is generated THEN the prompt SHALL include `angle` (with topic + description)
2. WHEN a Review Session item is evaluated THEN the evaluation prompt SHALL include `angle`
3. WHEN Study UI lists or displays a review item THEN it SHALL show `topic — angle` (or equivalent clear pairing)

**Independent Test**: Question/eval prompt builders include angle section. FE card shows both labels.

---

## Edge Cases

- WHEN the LLM emits a vague new angle like `general` or `basics` THEN the generator prompt SHALL instruct against it for new items (backfilled historical `general` remains valid)
- WHEN synonym angles collide via similarity THEN merge SHALL skip insert (no duplicate near-matches)
- WHEN a learned `(topic, angle)` appears again in Practice generation THEN merge SHALL skip (no auto-reactivate)
- WHEN `angle` is missing from LLM output THEN structured schema validation SHALL reject the payload (required field)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ANGLE-01 | P1: Persist | Execute | Verified |
| ANGLE-02 | P1: Persist (migration backfill) | Execute | Verified |
| ANGLE-03 | P1: Persist (uniqueness) | Execute | Verified |
| ANGLE-04 | P1: Persist (API expose) | Execute | Verified |
| ANGLE-05 | P1: Persist (session snapshot) | Execute | Verified |
| ANGLE-06 | P1: Generator schema/prompt | Execute | Verified |
| ANGLE-07 | P1: Merge skip on match | Execute | Verified |
| ANGLE-08 | P1: Merge insert new pair | Execute | Verified |
| ANGLE-09 | P1: Pair similarity | Execute | Verified |
| ANGLE-10 | P1: Practice covered angles | Execute | Verified |
| ANGLE-11 | P1: Practice variety instructions | Execute | Verified |
| ANGLE-12 | P1: Study question prompt | Execute | Verified |
| ANGLE-13 | P1: Study eval prompt | Execute | Verified |
| ANGLE-14 | P1: Study UI display | Execute | Verified |

**Coverage:** 14 total, 14 mapped to tasks, 0 unmapped

---

## Success Criteria

- [x] Same topic + different angles → multiple active review items
- [x] Practice interviewer prompt includes covered angles and variety guidance
- [x] Study Q&A prompts include angle; UI shows `topic — angle`
- [x] Existing rows migrate with `angle = 'general'` without data loss
- [x] Unit/integration tests cover schema, merge, prompts; FE types compile
