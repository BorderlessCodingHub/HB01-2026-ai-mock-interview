# Review Item Angles — Context

**Gathered:** 2026-08-02  
**Spec:** `.specs/features/review-item-angles/spec.md`  
**Status:** Ready for design

---

## Feature Boundary

Persist `angle` on review items; Practice prefers uncovered angles; Study reinforces missed angles. No taxonomy table, no SRS, no auto-split of history beyond `general` backfill.

---

## Implementation Decisions

### What is an angle?

- Free-text LLM label for the specific probe/facet that exposed the gap
- Distinct from `topic` (subject) and `description` (coaching narrative)
- Discovered from existing interviewer language (“do not linger or repeat the same angle”)
- Owner deferred definition to agent research — locked in spec

### Scope of this pass

- Full loop: persist + practice variety + study reinforcement
- Not persist-only

### Uniqueness and mastery

- Unique on `(userId, topic, angle)`
- One row = one missed angle; reuse `status` / `learnedAt`
- No separate `topic_coverage` table (`review_items` is the ledger)
- Learned re-hit in Practice: insert-skip (no auto-reactivate)

### Migration

- Backfill existing rows with `angle = 'general'`
- No LLM re-label of historical descriptions in v1

### Agent's Discretion

- Exact prompt section headers and wording for covered-angles / angle sections
- Similarity query shape for `(topic, angle)` pair (reuse ~0.7 `pg_trgm` threshold)
- Whether covered angles load once per session start vs every turn (prefer session-stable system prompt for cacheability when feasible)
- FE display delimiter (`topic — angle`)

---

## Specific References

- Deferred idea from review-items-learned-status: `topic_coverage` for practice diversity — fulfilled here via review_items + interviewer prompt feed
- Interviewer conduct: “do not linger or repeat the same angle”

---

## Deferred Ideas

- Controlled taxonomy / curriculum graph
- Spaced repetition
- Auto-split historical `description` into multiple angles
- Auto-reactivate learned angles on practice re-hit
- WeakAnswers schema angle field
