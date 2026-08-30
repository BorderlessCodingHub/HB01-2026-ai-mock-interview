# Review Session Recap — Context

**Gathered:** 2026-08-29 (product discussion from tester feedback on `/study`)
**Spec:** `.specs/features/review-session-recap/spec.md`
**Status:** Ready for design approval → Tasks

---

## Feature Boundary

After a Review Session Q&A, the candidate must see **how the session went** (per-topic “what went well” / “what to work on”) **before and together with** confirming list outcomes (priority / learned). Same `/report` route. Recap is persisted and shown again when opening a **completed** session from `/study` history (results above transcript). No per-question coaching. No second session-level LLM.

---

## Implementation Decisions

### Trigger & problem

- Tester: answering review questions had **no final feedback**; last submit jumped straight to **change topic priority**.
- Root cause: last-turn evaluation only produces `{ status, priority }`; `/report` is framed as housekeeping (“Review suggestions”), and the last SSE turn shows a typing indicator then “Redirecting…”.

### Where the recap lives

- **Same page as the report** (`/review-session/[sessionId]/report`): recap first on each card, then Keep active / Mark as learned / priority.
- **Not** a new route, **not** a Practice-style closing bubble in the chat, **not** a two-step recap-then-apply wizard.
- Chat is only used for the **evaluating wait** after the last answer.

### Closing grain & shape

- **Per topic**, not one session-level narrative. Topics are evaluated in isolation today; a Practice-style overall impression across unrelated items is the wrong unit.
- Session header is **derived in the UI** (counts: topics reviewed, suggested learned, priority changes) — no extra LLM.
- Closing text is **structured bullets** on the card: `wentWell[]` and `workOn[]`, produced by the **existing parallel evaluation** (extend structured output). Do not add a second model call after evaluation.

### Last-answer transition

- Stay on the chat. Replace the “typing / next question” affordance with **“Evaluating your answers…”**.
- Navigate to `/report` only after `meta.status === "pending_review"` (evaluation finished).

### History

- Persist recap on `ReviewSessionItem`.
- Completed session at `/study?sessionId=`: **read-only results block above the Q&A transcript** (overturns study-session-history “transcript-only / no outcomes” MVP).
- No tabs; no separate “View results” route.
- Recap text is the evaluation (immutable). Applied list outcome uses **confirmed** status/priority.

### Locale

- Bullets **and** recap section headings follow the **session** `interviewLocale` (`en` | `pt`), same as the questions.
- Chrome around Apply / Study hub stays English (`STUDY-DEC-08`).

### Evaluation failure

- Same as today: warning, no bullets, user still chooses priority / learned; item is included in bulk apply.

### Unchanged (locked from Study Hub)

- Single bulk **Apply**; auto-apply on leave (`STUDY-DEC-03`, `STUDY-DEC-04`).
- Q&A remains question-only (no mid-session feedback).
- Merge / suggestion rules for status and priority stay as they are.

### Agent's Discretion

- Exact English page title / header copy (recommendation: “Review results” + one-line description that this is both recap and list confirmation).
- Bullet caps (count and character length) in the Zod schema — keep cards scannable.
- Empty `wentWell` / `workOn` UI fallback copy (do not invent strengths in the prompt).
- Whether the backend emits an explicit `evaluating` SSE meta vs the client inferring last-answer from progress — Design; user-visible behavior is locked.
- Card layout density; reuse vs split of `ReviewReportCard` for read-only history.
- Exposing `interviewLocale` on `GET /api/review-sessions/:id` if missing (needed for heading copy on history).

---

## Specific References

- Tester feedback (2026-08-29): no final session feedback; last answer → priority screen.
- Practice closing: `getClosingFeedbackCopy` headings “What went well” / “What to work on” (PT: “O que você fez bem” / “O que precisa trabalhar”).
- Current jump: `ReviewSessionChat` on `pending_review` meta → `router.push(.../report)`; report title “Review suggestions”.
- Evaluation: `reviewSessionEvaluationOutputSchema` is only `{ status, priority }`; `runEvaluation` already waits on the last SSE turn with no tokens.

---

## Deferred Ideas

- Per-question feedback after each answer — discussed; out of this iteration.
- Session-level closing LLM (second call after parallel eval) — rejected for wait/cost; derived header only.
- Two-screen recap then apply — rejected (auto-apply and extra navigation).
- Chat closing message like Practice — rejected; recap belongs on the results page and in history.
- Spaced repetition / analytics over recap quality — separate product.
