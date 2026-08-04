# State

**Last Updated:** 2026-08-04  
**Current Work:** Quick fix — practice maxTurns +1 for auto ready message (done; commit deferred)

---

## Recent Decisions (Last 60 days)

### AD-016: Practice soft coverage (topic+angle), not hard exclude (2026-08-02)

**Decision:** Practice interviews get **balanced soft coverage**: async post-interview LLM extracts ≤8 free-text `{topic, angle}` rows (append-only, retain last ~100/user); next session injects ≤12 coverage + ≤8 active review topics once into the interviewer system prompt. Weak = active review backlog (mastery on `/study`); strong/covered = lower priority, different angle if revisited. Soft prompt only — no hard exclude, regenerate, angle enum, transcript dump, or Study CTA in MVP.
**Reason:** Cross-session repetition is massante; full history in prompt is too expensive; hard novelty exhausts the CV and blurs Practice vs Study.
**Trade-off:** Soft guidance can still occasionally echo; no candidate-facing coverage UI/status in MVP.
**Impact:** New backend feature `interview-soft-coverage` (table + BullMQ job + interviewer prompt); finish path enqueues alongside review/weak-answer jobs.
**Spec:** `backend/.specs/features/interview-soft-coverage/spec.md`  
**Context:** `backend/.specs/features/interview-soft-coverage/context.md`

### AD-015: Study Session History on `/practice`-like `/study` shell (2026-07-28)

**Decision:** Persist completed Review Session history in a `/study` sidebar (topics + date + badge); click opens read-only Q&A via `/study?sessionId=`; open sessions stay on resume banner. Single `GET /api/review-sessions` with status + page/limit=10; expose `turns` on `GET /:id`. No report/outcomes in MVP transcript.
**Reason:** Parent Study Hub deferred history; candidates need durable recall like interview practice history.
**Trade-off:** Requires backend list + turns exposure before FE; `/study` layout restructure; banner migrates off storage-only.
**Impact:** New feature specs under `frontend/.specs/features/study-session-history/`; extends review-sessions API; reshapes Study hub UI.
**Spec:** `frontend/.specs/features/study-session-history/spec.md`  
**Context:** `frontend/.specs/features/study-session-history/context.md`

### AD-014: Decode Borderless Bearer without signature verify (2026-07-23)

**Decision:** Remove `BORDERLESS_JWT_SECRET`. Express accepts Borderless Bearer tokens that are either JWTs (`jwt.decode` + `exp` + identity claims) or **opaque** strings registered at login into Redis via `POST /internal/borderless-sessions` (Next.js → Express, protected by `INTERNAL_AUTH_SYNC_SECRET`). Then upserts local `User` by `externalId`.
**Reason:** Borderless confirmed they do not share a JWT secret; real `accessToken` values are opaque (not JWT). Contract is `POST /api/auth/signin` → use `accessToken` as Bearer; no introspect/`me` endpoint.
**Trade-off:** Tokens are not cryptographically authenticated by this API until Borderless documents introspect/`me`.  
**Impact:** `BorderlessAccessTokenParser`, env schema, test helpers.  
**Spec:** `.specs/features/borderless-better-auth/`

### AD-013: Borderless Bearer + better-auth on Next (2026-07-23)

**Decision:** Replace local JWT auth with better-auth on Next.js that calls Borderless `POST /api/auth/signin`. Express accepts only Borderless `accessToken` as Bearer; local `User` upserted by `externalId` (Int FKs preserved). Remove local signup/login/refresh/password-reset. Login-only UI.  
**Reason:** Single identity source (Borderless); product is a Borderless Coding surface.  
**Trade-off:** No in-app signup/reset until Borderless documents them; no refresh — expiry forces re-login; overturns “avoid migrating auth” spirit of AD-009 while keeping Int FKs.  
**Impact:** FE better-auth + credentials plugin; BE decode-only Bearer parser + user sync; Prisma `externalId`, nullable `password`, drop `RefreshToken`.  
**Spec:** `.specs/features/borderless-better-auth/spec.md`  
**Context:** `.specs/features/borderless-better-auth/context.md`

### AD-012: Interview speech-to-text via AssemblyAI batch + port (2026-07-21)

**Decision:** Mic on Practice + Review session composers; record ≤1 min → confirm Transcribe → `POST /api/transcribe` (Bearer + AI rate limit by userId) → append text to draft. Language detection only (`pt`/`en`). Sync poll in API (1.5s / 60s). AssemblyAI isolated behind `ISpeechToText` (or equivalent) port + adapter + factory.  
**Reason:** Closer to real interview answers; keep FE free of provider secrets; swap provider later without route/contract churn.  
**Trade-off:** Request held open during poll (acceptable for ≤1 min audio); no streaming partials; local EN/PT STT strings only (not full app i18n).  
**Impact:** New backend module/route, env `ASSEMBLYAI_API_KEY`, FE MediaRecorder UX on shared composer.  
**Spec:** `.specs/features/interview-speech-to-text/spec.md`  
**Context:** `.specs/features/interview-speech-to-text/context.md`

### AD-011: Async review items via BullMQ (same worker) (2026-07-09)

**Decision:** Final interview turn finishes conversation (`isFinished`) and enqueues review-item extraction on a dedicated BullMQ queue processed by existing `src/worker.ts`; session exposes `reviewGenerationStatus` (`idle|pending|ready|failed`). Overturns sync generate-then-finish and prior `ICF-DEC-01` limbo behavior.  
**Reason:** Last-turn latency, limbo sessions on LLM failure, align with resume async pattern for production.  
**Trade-off:** Eventual consistency for review list; FE must poll/handle pending; slightly more surface area (status + queue).  
**Impact:** `InterviewStreamService` finish path, Prisma session columns, new queue + worker handler, session API + SSE meta, FE poll + retry endpoint.  
**Spec:** `.specs/features/async-review-items-generation/spec.md`  
**Design:** `.specs/features/async-review-items-generation/design.md`

### AD-010: Interview locale preference on User + body enum for prompts (2026-07-09)

**Decision:** `User.interviewLocale` (`en` | `pt`, nullable) for preference; create/stream require allowlisted `interviewLocale`; const map builds end-of-system-prompt language block; session column stores completion locale for metrics.  
**Reason:** Avoid prompt injection from free-text language; avoid per-turn User reads; keep UI i18n separate later.  
**Trade-off:** FE must always send locale on create/stream; mid-session change relies on next request body, not DB.  
**Impact:** Auth payload, new PATCH endpoint, Prisma on User + InterviewSession + ReviewSession, five prompt builders, FE selector on `/practice` and `/study`.  
**Spec:** `.specs/features/interview-locale/spec.md`

### AD-009: Use existing `Int` user IDs (not UUID) for FK columns (2026-05-27)

**Decision:** Aligns with current Prisma `User` model; avoids migration of auth layer.  
**Reason:** Brownfield auth.  
**Trade-off:** Entity PKs remain UUID; user FKs stay Int.  
**Impact:** All interview/resume FKs use Int `userId`.

### AD-008: Resume/session/message/review entity IDs use UUID (2026-05-27)

**Decision:** UUID PKs for interview domain entities.  
**Reason:** Matches LangGraph `thread_id` requirement.  
**Trade-off:** Mixed Int/UUID ID strategy.  
**Impact:** Session ids are UUID strings in API paths.

---

## Active Blockers

_None_

---

## Lessons Learned

### L-006: ISC-21 soft-hint load every turn (2026-08-02)

**Context:** Spec ISC-21 said inject soft coverage once per session into graph/checkpoint.  
**Problem:** Approved design intentionally loads soft hints every `streamTurn` (same as résumé) to avoid LangGraph empty-array overwrite of checkpointed state.  
**Solution:** Implemented per design; marked SPEC_DEVIATION on ISC-21 in feature `spec.md`.  
**Prevents:** Reverting to once-only load and regressing prompt emptiness mid-session.

### L-005: Parallel Execute agents racing git commit (2026-07-21)

**Context:** Interview STT Phase 2 launched T3–T8 in parallel with each agent committing.  
**Problem:** Contaminated atomic commits (T4+T7, T8+T6); hook/type races.  
**Solution:** Orchestrator serializes commits (or defer end-of-feature commit); agents implement+verify only.  
**Prevents:** Mixed task commits during parallel Execute.

### L-004: Parallel Execute without per-task commits still needs shared factory first (2026-07-10)

**Context:** T7 and T8 both needed `makeReviewGenerationService`.  
**Problem:** Parallel agents would race creating the same factory file.  
**Solution:** Orchestrator created the shared factory before launching T7/T8.  
**Prevents:** Duplicate/conflicting factory files during parallel HTTP+worker work.

### L-003: Required body fields break unrelated E2E helpers (2026-07-09)

**Context:** Validation after interview-locale made `interviewLocale` required on interview create/stream.  
**Problem:** `rate-limit-redis` and `token-usage` E2E still sent old payloads → 422 instead of 201.  
**Solution:** Added `interviewLocale: "en"` to create/stream bodies in those suites; grepped remaining E2E helpers.  
**Prevents:** “Feature E2E green, full suite red” after schema tightenings.

### L-001: Required Prisma fields break check-types before callers exist (2026-07-09)

**Context:** T1 added required `interviewLocale` on session models.  
**Problem:** `bun run check-types` failed across repos/fixtures before T6/T11 could wire params.  
**Solution:** Temporary `@default(en)` + create stubs, then replace with real params in T6/T11.  
**Prevents:** Blocking foundation commits on downstream call-site updates; plan stub→wire when schema gates include full tsc.

### L-002: Parallel subagents race git staging (2026-07-09)

**Context:** Multiple agents committing concurrently on the same branch.  
**Problem:** Accidental inclusion of unrelated WIP in commits; Soft-resets needed.  
**Solution:** Each agent stages only its file list; orchestrator serializes commits when paths overlap. User may also defer all commits to end of Execute.  
**Prevents:** Contaminated atomic commits during parallel Execute.

---

## Quick Tasks Completed

| # | Description | Date | Commit | Status |
| --- | ---------- | ---- | ------ | ------ |
| — | — | — | — | — |

---

## Deferred Ideas

- [ ] Normal-interview topic diversity via angles on review_items (fulfilled by review-item-angles) — Captured during: review-items-learned-status / review-item-angles
- [ ] App-wide UI i18n (`appLocale` or similar) — Captured during: interview-locale
- [ ] DB table for editable language prompt instructions — Captured during: interview-locale
- [ ] Analytics dashboard for EN vs PT session counts — Captured during: interview-locale
- [ ] Resume reprocessing endpoint (re-queue failed/processing jobs)
- [ ] Webhook or push notification when resume processing completes
- [ ] Webhook or push when review generation completes — Captured during: async-review-items-generation
- [ ] Export interview transcript as PDF
- [ ] Bull Board / admin UI for queue ops — Captured during: async-review-items-generation
- [ ] Persist STT audio/transcripts; use language_code to suggest interviewLocale; streaming STT; auto-send after transcribe — Captured during: interview-speech-to-text
- [ ] Hard exclude / regenerate / embeddings / UI modes / Study CTA for practice coverage — Captured during: interview-soft-coverage (soft MVP first; replaces prior hard `topic_coverage` exclude idea from review-items-learned-status)

---

## Todos

- [x] Grill-me + Specify interview-soft-coverage → `spec.md` + `context.md` (2026-08-02)
- [x] Design phase for interview-soft-coverage (`design.md`) — approved
- [x] Tasks breakdown for interview-soft-coverage (`tasks.md`) — approved via Execute
- [x] Execute T1–T11 interview-soft-coverage (commits deferred) (2026-08-02)
- [x] Grill-me + Specify study-session-history → `spec.md` + `context.md` (2026-07-28)
- [x] Design phase for study-session-history (`design.md`) — approved
- [x] Tasks breakdown for study-session-history (`tasks.md`) — draft, awaiting approval
- [x] Execute study-session-history (T1–T14) — implemented; commit deferred by user; no commits made
- [ ] Interactive UAT for study-session-history (history sidebar, transcript, Load more, banner via API)
- [ ] Commit study-session-history (deferred — user requested no commits)
- [x] Grill-me + Specify interview-speech-to-text → `spec.md` + `context.md`
- [x] Design phase for interview-speech-to-text (`design.md`) — approved
- [x] Tasks breakdown for interview-speech-to-text (`tasks.md`) — draft, awaiting approval
- [x] Execute interview-speech-to-text (T1–T10) — implemented; E2E blocked (Docker Desktop not running); commit deferred
- [x] Verify T3 AssemblyAI adapter (`infrastructure/speech-to-text`) — lint/types/3 unit tests green (2026-07-21)
- [ ] Run transcribe E2E with Docker Desktop + optional live AssemblyAI smoke
- [ ] Interactive UAT for interview-speech-to-text (Practice + Review mic flow)
- [x] Discuss gray areas for async-review-items-generation → `context.md`
- [x] Design phase for async-review-items-generation (`design.md`) — approved
- [x] Tasks breakdown for async-review-items-generation (`tasks.md`)
- [x] Execute async-review-items-generation (T1–T11) — implemented; user will commit
- [x] Feature-level automated validation (2026-07-10) — unit/integration/e2e + FE types/build green
- [ ] Interactive UAT for async-review-items-generation (pending/ready/failed UX)
- [ ] Commit async-review-items-generation (deferred by user request)
- [x] Design phase for interview-locale (`design.md`)
- [x] Tasks breakdown for interview-locale (`tasks.md`)
- [x] Execute interview-locale (T1–T18)
- [x] Feature-level validation (2026-07-09)
- [x] Fix collateral E2E: rate-limit-redis + token-usage send `interviewLocale`
- [x] Align spec.md acceptance text 400 → 422 (design already documents)
- [x] Delete leftover `.tmp-wip-*` prompt scratch folders

---

## Open Questions (resolved)

| ID | Question | Status |
|----|----------|--------|
| OQ-01 | Default interview language (PT-BR vs EN)? | **Resolved** — user preference `interviewLocale`; browser bootstrap; non-EN/PT → `en` |
| OQ-02 | Review item similarity threshold for deduplication | Open — propose 0.85 cosine in Design (unrelated feature) |
| OQ-03 | Client payload for `POST .../stream` (message text field name) | Open historically; current API uses `{ content }` / `{ answer }` |

---

## Preferences

- Grill-me used for disambiguation before Specify on interview-locale, interview-speech-to-text, and interview-soft-coverage
- Spec-driven Specify used for async-review-items-generation (architecture pre-aligned in chat)
- Prefer single end-of-feature commit over per-task commits when requested
- External providers must stay behind ports/adapters (R2, mailer, LLM generators, STT)
- Lightweight verify/validate tasks are fine on faster/cheaper models
