# Interview Soft Coverage — Context

**Gathered:** 2026-08-02  
**Spec:** `.specs/features/interview-soft-coverage/spec.md` (under `backend/`)  
**Status:** Ready for design → Design drafted  
**Source:** Grill-me session (Balanced soft coverage) + Specify

---

## Feature Boundary

After each finished **practice** interview, asynchronously extract and store compact **topic + free-text angle** coverage. On the **next** practice session, inject a **capped soft-guidance** block (recent coverage + active review topics) once into the interviewer system prompt so the AI prefers fresh angles and under-explored areas, may lightly revisit weak topics with a **different** angle, and de-prioritizes well-covered material — without hard excludes, without transcript dumping, and without turning `/practice` into `/study`.

---

## Implementation Decisions

### Unit of coverage

- Persist **topic + angle** (not topic-only, not full question text, not category slots alone).
- Same topic may return if the **angle** differs.
- Angles are **not** a fixed enum.

### Weak vs strong (no new outcome enum on coverage)

- Coverage rows do **not** store `weak|strong`.
- **Weak** is inferred from the existing backlog: **active review items** injected into the prompt.
- Weak topics: practice **may** touch them with a **different angle**; **mastery happens in Study**.
- Strong / covered without active gap: **lower priority** to cover again; if covered again, **different angle** — **not** a permanent ban.
- Weak-answer **snippets** are **not** passed into the interviewer prompt in MVP.

### Extraction

- Dedicated **async LLM job** after interview finish (separate from review-item generation).
- Use **structured output**: `{ items: [{ topic, angle }] }` with free-text fields.
- Cap at **5–8** representative pairs per session (**spec locks max 8**).

### Persistence / identity

- **Append-only** inserts (preserve multiple angles over time).
- No semantic similarity merge in MVP.
- Retention: keep only the **last K ≈ 100** rows per user (prune older).

### Prompt injection

- Inject **coverage (≤12 most recent)** + **active review topics (≤8, high priority first)**.
- Soft behavioral rules in system prompt only (**no** regenerate / hard exclude).
- Inject **once per session** into system prompt / initial graph state (stays in checkpoint); do **not** rebuild every turn.
- No separate immutable snapshot column on `InterviewSession` required for MVP (graph/prompt state is enough).

### Failure / cold start

- Coverage is **best-effort**; never block finish or start.
- If coverage is empty, practice continues as today for that part of the prompt; active reviews still inject when present (normal composition with empty coverage list).

### Product / UX scope

- **No** Study CTA in this MVP.
- **No** Explore/Balanced/Pressure mode selector — single default balanced soft behavior.
- **No** frontend coverage browser/editor in MVP.
- P2 observability for ops is optional and must not force candidate-facing status UX.

### Agent's Discretion

- Exact Prisma model/table name (`TopicCoverage` vs similar).
- Whether coverage enqueue shares finish-path helpers with review/weak-answer queues vs parallel call sites.
- Exact prompt section copy and whether soft-block meta-instructions are always English while topic/angle strings stay in interview locale.
- Whether P2 observability is a session column, structured logs only, or both.
- Truncation strategy when structured output exceeds 8 items (schema `max` vs slice).
- Precise `createdAt` ordering and timezone for “most recent.”

---

## Specific References

- Product split already in the app: `/practice` = discovery; `/study` = deliberate practice on review items until `learned`.
- Deferred idea in `review-items-learned-status` mentioned hard `topic_coverage` exclude/mastered tracking — this feature **replaces that intent for MVP** with **soft** guidance, not hard exclusion.
- User emphasis: angles must stay **non-fixed**; structured output for shape only.
- User emphasis: weak items revisited with different angles in practice are OK, but Study is where mastery happens.

---

## Deferred Ideas

- Hard exclude / one-shot regenerate on near-duplicate questions
- Angle `kind` enum + free-text detail hybrid
- Embedding-based anti-similarity
- UI modes (Explore / Balanced / Pressure)
- Study CTA / system-suggested Review Sessions after dense coverage
- Passing weak-answer snippets into practice prompts
- Snapshot column on `InterviewSession` for audit of the exact brief used
- Frontend visibility/editing of coverage history
- Unifying coverage extraction into the same LLM pass as review-item generation (cost optimization later)
