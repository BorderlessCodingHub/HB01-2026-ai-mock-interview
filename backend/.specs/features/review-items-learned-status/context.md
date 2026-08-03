# Review Items Learned Status — Context

**Gathered:** 2026-07-07 (grill-me session, revised same day after flow discussion)
**Spec:** `.specs/features/review-items-learned-status/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Introduce a dedicated **Review Session** flow: the user explicitly selects which `active` review items to work on, answers a fixed number of adaptive follow-up questions per item over SSE (reusing the existing mock-interview streaming infrastructure), and — once every selected item is answered — the backend evaluates all items **in parallel**, producing a **suggestion** (learned / priority) per item. The user is then shown a **report** comparing current vs. suggested outcome per item, and must **confirm, override, or mark learned** each one before anything is actually persisted to `review_items`. This replaces the original idea of reassessing *all* active items on every normal interview's final turn, and keeps the user in control of what changes on their study list.

Normal mock interviews (`ai-mock-interview`) are explicitly **out of scope for mutating existing review items** going forward — that responsibility moves entirely to Review Sessions and manual `PATCH`. Topic-diversity / "mastered topic" tracking for normal interviews is being discussed as a **separate, follow-up feature** and is not designed here (see Deferred Ideas).

---

## Why the original design changed

The initial spec required the final-turn LLM of **every** mock interview to reassess **all** active review items, regardless of whether they came up in that conversation. Discovery with the user surfaced two problems this created:

1. **Repetitive/tiresome interviews** — normal interviews would keep circling back to the same known gaps instead of covering new ground.
2. **Forced, low-signal judgments** — the LLM had to output a status/priority opinion on topics never discussed, risking noisy or hallucinated assessments.

Resolution: split "find new gaps" (normal interview) from "reassess known gaps" (dedicated Review Session) into two different flows with two different triggers.

---

## Implementation Decisions

### Progression model (unchanged from original discovery)

- Use **`learned` status** (archive), not priority reduction alone, as the primary "mastered" signal.
- Learned items **do not appear** in the default study list (`status=active`).
- Active items retain `priority` (`low` | `medium` | `high`) for ordering.

### Who decides, and when

- **User** triggers a **Review Session** manually, selecting which `active` items to review (multi-select from the priority-ordered list). No automatic/system-suggested trigger for this iteration.
- **User** can also manually mark/unmark learned via API (`PATCH`), independent of Review Sessions.
- Normal mock interviews (`ai-mock-interview`) **do not** trigger status/priority changes on existing review items anymore. (Deferred: how normal interviews discover new gaps / track mastered topics is a separate feature — see Deferred Ideas.)

### Review Session flow (new, replaces "final-turn reassesses everything")

1. **Selection**: `POST /api/review-sessions { reviewItemIds: string[] }` — user picks a subset of their own `active` review items. Items are presented to the user pre-sorted by priority desc (existing `GET /api/review-items` ordering), but the request accepts an explicit list (order of `reviewItemIds` may double as intended review order).
2. **Per-item adaptive Q&A over SSE**: for each selected item, the backend asks a fixed number `N` of questions (default `N = 3`, constant/env-configurable), scoped **only to that item's own topic/description**. Each follow-up question is generated considering only the **previous answers within that same item** (isolated context) — not the full session transcript and not other items. This bounds LLM context/cost regardless of how many items are in the session.
3. **No full-session transcript persistence**: unlike normal interviews, there is no cross-item running conversation history kept in the LLM context. Each `ReviewSessionItem` carries its own bounded `turns` (topic + N Q&A pairs).
4. **Streaming transport**: reuse the existing SSE infrastructure verbatim — `src/shared/utils/sse.ts` (`writeEvent`/`writeDone`, events `token` | `meta` | `error`, terminal `[DONE]`), the same `res.writeHead`/`flushHeaders` pattern, and the same async-generator-to-SSE-loop shape as `InterviewStreamService` (`src/modules/interview/service/stream-service.ts`). A new orchestrator (e.g. `ReviewSessionStreamService`) mirrors that structure but drives per-item question generation instead of the interviewer graph node.
5. **Evaluation timing**: only **after all selected items have reached `N` answered turns**, the backend runs evaluation for **every item in parallel** (e.g. `Promise.all`), each call scoped to `{ topic, description, current priority, that item's Q&A turns }` only. No item's evaluation depends on another's.
6. **Evaluation output is a suggestion, not a mutation**: results are written to `ReviewSessionItem.suggestedStatus`/`suggestedPriority` only. The underlying `review_items` row is **not** touched at this point. `ReviewSession.status` becomes `pending_review`.
7. **Report + mandatory user confirmation**: the user sees, per item, `currentPriority` vs. `suggestedStatus`/`suggestedPriority`, and must take one explicit action per item:
   - **Accept** the suggestion as-is.
   - **Override** with a different priority (stays `active`).
   - **Mark learned** themselves, regardless of the suggestion.
   Only this confirmation step calls `ReviewMergeService` and persists the change to `review_items`. A session can sit `pending_review` indefinitely; there's no auto-confirmation or expiry in this iteration.
8. **Merge rules unchanged in substance, but only applied on confirmation**: the existing `RIL-DEC-01`–`06` rules (never decrease without clear evidence, never below `low`, `learned` sets `learned_at`, bump-on-reinforcement safety net baked into the *suggestion*) still apply — they are just triggered **when the user confirms/overrides a Review Session item**, not automatically right after evaluation, and scoped to the items in that session (not the user's entire active list). A user override always applies exactly as chosen (no re-derivation on top of an explicit human choice).
9. **No semantic reactivation inside Review Sessions**: reactivation of `learned` items via semantic search stays tied to **new gap discovery** (wherever that ends up living — normal interviews or a future feature), not to Review Sessions, since Review Sessions only ever operate on already-`active` items the user explicitly selected.

### Data model for Review Sessions (new, lightweight — not reusing `InterviewSession`)

Deliberately **not** reusing the heavier `InterviewSession`/message-turn model (that one is built for open-ended, streamed conversation with LangGraph checkpointing). Review Sessions are structured and bounded, so a lighter shape is preferred:

```
ReviewSession
- id, userId
- status: in_progress | pending_review | completed
- createdAt, evaluatedAt, completedAt

ReviewSessionItem
- id, reviewSessionId (FK)
- reviewItemId (FK to review_items)
- topic, description        // snapshot at session start
- turns: [{ question, answer }]   // JSON, bounded to N entries
- currentPriority                    // snapshot of priority at session start (for the report)
- suggestedStatus: active | learned | null   // filled only after evaluation; NOT yet applied
- suggestedPriority: ReviewPriority | null
- confirmedStatus: active | learned | null   // filled only after user acts; drives the real update
- confirmedPriority: ReviewPriority | null
- confirmedAt
```

Exact schema (columns vs JSON, Prisma model names) is a **Design-phase** decision.

### Question generation strategy

- **Adaptive with bounded cost**: each question after the first is generated using only that item's own prior Q&A pairs (small, constant-size context per call) — not batch-generated upfront and not conditioned on the full session.
- Fixed `N` per item for this iteration (no user-configurable slider yet).

### API exposure (additions on top of original GET/PATCH/DELETE)

- `POST /api/review-sessions` — create a session with selected `reviewItemIds`.
- `POST /api/review-sessions/:id/stream` (or equivalent SSE-driving endpoint) — submit an answer, stream back the next question, item-transition/completion events, and — on the final turn — the suggestion report.
- `GET /api/review-sessions/:id` — fetch the session's current state/report (current vs. suggested vs. confirmed per item).
- `POST /api/review-sessions/:id/items/:itemId/confirm` — user decision per item: `accept` the suggestion, `override` with a chosen priority, or `override` to `learned`. Only this call mutates `review_items`.
- Existing `GET /api/review-items?status=...` and `PATCH /api/review-items/:id` from the original spec are unchanged and still needed (manual override outside of a session, listing).
- Exact route shapes/verbs are a **Design-phase** decision; this context fixes the behavior, not the wire format.

### Reuse from existing SSE/interview infrastructure

- `src/shared/utils/sse.ts` (`writeEvent`, `writeDone`, `SseEvent` union) — reused as-is.
- SSE header block and `res.writeHead`/`flushHeaders`/`res.on("close", ...)` abort-handling pattern from `InterviewStreamService` (`src/modules/interview/service/stream-service.ts`) — reused as the template for a new `ReviewSessionStreamService`.
- The async-generator → SSE-loop shape (`IInterviewGraph`-style protocol) is the pattern to follow for a new, review-session-specific generator (per-item question generation instead of the LangGraph interviewer node). Whether the new generator is LangGraph-based or a plain LLM-call loop is a **Design-phase** decision.
- Token usage capture/recording (`createUsageCaptureCallback`, `TokenUsageService`) and the AI rate limiter middleware should be reused for Review Session calls the same way they're used for interview turns.
- `ReviewMergeService`'s priority/`learned` merge rules are reused, but invoked per Review Session item instead of from `InterviewStreamService`'s final-turn block.

---

## Agent's Discretion

- Exact prompt wording for "clear evidence of improvement" and "sufficient demonstration to mark learned" (per-item suggestion prompt).
- Whether to keep the existing **priority bump safety net** for recurring gaps within a Review Session item (recommendation: keep — bake it into the *suggestion*, not the confirmation step; if evaluation shows the gap still present with no improvement signal, suggest a one-step bump, same as before).
- `learnedAt` timestamp field (recommended, unchanged from original decision).
- Whether Review Session results (suggestions + confirmations) are also written to a "history" for the user to see past review sessions (nice-to-have, not required by any story yet).
- Exact SSE event names/payloads for review-session-specific signals (e.g. distinguishing "next question for same item" vs "moving to next item" vs "session pending_review, here's the report").
- Whether a bulk "accept all suggestions" convenience endpoint/action is added later (deferred for MVP; user confirms per item).
- What happens if the user never confirms a `pending_review` session (no expiry/auto-confirmation designed yet — left open, low risk since `review_items` stays untouched until confirmed).

---

## Specific References

- Existing SSE contract: `src/shared/utils/sse.ts`, `src/modules/interview/service/stream-service.ts` — event types `token`/`meta`/`error`, terminal `[DONE]`, `res.writeHead`/`flushHeaders`, abort-on-`close` handling.
- Existing merge behavior to preserve: `ReviewMergeService` (`src/modules/interview/service/review-merge-service.ts`) — `maxPriority` + bump; now also needs a "decrease with evidence" and "learned" path per `RIL-DEC-06`.
- Existing spec constraint "do not lower priority" in [ai-mock-interview/spec.md](../ai-mock-interview/spec.md) is **superseded** by this feature — and normal interviews no longer touch review items' priority/status at all (all mutation now flows through Review Sessions or manual PATCH).
- Semantic similarity already used for topic dedup (`TOPIC_SIMILARITY_THRESHOLD = 0.7`) — still relevant for gap discovery/reactivation, but that now lives outside this feature's Review Session flow (see Deferred Ideas / follow-up feature).

---

## Deferred Ideas

- **Normal-interview topic diversity + "mastered topic" tracking**: originally envisioned as hard exclude via `topic_coverage`. **Superseded for MVP by** [Interview Soft Coverage](../interview-soft-coverage/spec.md) (soft prompt guidance with free-text topic+angle; no hard exclude). Hard exclude / mastered tracking remains a possible follow-up if soft guidance is insufficient.
- System-suggested Review Session prompts (e.g. "you have 5 high-priority items, want to review them?") — deferred; manual trigger only for now.
- User-configurable `N` (number of questions per item) — deferred; fixed default for MVP.
- Automatic priority **decay** for active items not reviewed in a while — still deferred, unchanged from original discovery.
- Frontend UI (learned tab, review session screen) — backend-only scope; API contract defined here.
- Bulk mark-all-learned or study streaks / spaced repetition — still deferred.
