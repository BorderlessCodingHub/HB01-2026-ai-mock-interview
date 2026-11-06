# Roadmap

| Priority | Feature | Status | Spec |
|----------|---------|--------|------|
| P0 | Signed Hone access tokens (AD-025) | PR #5 open — deploy needs `HONE_JWT_SECRET` | [ANALYSIS §3.1](./ANALYSIS-2026-11-06.md) |
| P0 | Level-up: gates, deploy, observability, docs (streams A + C) | Planned (2026-11-06) | [LEVEL-UP-PLAN.md](./LEVEL-UP-PLAN.md) |
| P1 | Progressive Web App v1 (install + offline history) | Specified (2026-11-06) | [spec.md](../features/pwa/spec.md) · [design.md](../features/pwa/design.md) · [tasks.md](../features/pwa/tasks.md) |
| P2 | Web Push notifications (PWA v2) | Not specified — design is LEVEL-UP C5 | — |
| P1 | Borderless Auth via better-auth | Implemented (E2E needs Docker + real Borderless JWT secret) | [spec.md](../features/borderless-better-auth/spec.md) · [context.md](../features/borderless-better-auth/context.md) · [design.md](../features/borderless-better-auth/design.md) · [tasks.md](../features/borderless-better-auth/tasks.md) |
| P1 | AI Mock Interview (backend) | Specified | [spec.md](../features/ai-mock-interview/spec.md) |
| P1 | Interview Locale (EN \| PT) | Done | [spec.md](../features/interview-locale/spec.md) · [design.md](../features/interview-locale/design.md) · [tasks.md](../features/interview-locale/tasks.md) |
| P1 | Async Review Items Generation (BullMQ) | Implemented (awaiting commit) | [spec.md](../features/async-review-items-generation/spec.md) · [design.md](../features/async-review-items-generation/design.md) · [tasks.md](../features/async-review-items-generation/tasks.md) · [context.md](../features/async-review-items-generation/context.md) |
| P2 | AI Mock Interview (frontend) | Pending | — |
| P2 | Interview Human Feedback (frontend integration) | Specified | [spec.md](../../frontend/.specs/features/interview-human-feedback/spec.md) |
| P2 | Interview Speech-to-Text (AssemblyAI batch) | Implemented (E2E/UAT/commit pending) | [spec.md](../features/interview-speech-to-text/spec.md) · [context.md](../features/interview-speech-to-text/context.md) · [design.md](../features/interview-speech-to-text/design.md) · [tasks.md](../features/interview-speech-to-text/tasks.md) |
| P2 | Study Session History (completed review sessions on `/study`) | Implemented (commit deferred) | [spec.md](../../frontend/.specs/features/study-session-history/spec.md) · [context.md](../../frontend/.specs/features/study-session-history/context.md) · [design.md](../../frontend/.specs/features/study-session-history/design.md) · [tasks.md](../../frontend/.specs/features/study-session-history/tasks.md) |
| P2 | Interview Soft Coverage (practice anti-echo via topic+angle memory) | Implemented (commits deferred) | [spec.md](../../backend/.specs/features/interview-soft-coverage/spec.md) · [context.md](../../backend/.specs/features/interview-soft-coverage/context.md) · [design.md](../../backend/.specs/features/interview-soft-coverage/design.md) · [tasks.md](../../backend/.specs/features/interview-soft-coverage/tasks.md) |
| P1 | Session Create Quota (3 practice + 3 study / rolling 4h) | Validated (UAT + commits deferred) | [spec.md](../features/session-create-quota/spec.md) · [design.md](../features/session-create-quota/design.md) · [tasks.md](../features/session-create-quota/tasks.md) |
| P1 | Resume TeX upload (`.tex` → GFM → same LLM extraction) | Validated (UAT + commits deferred) | [spec.md](../features/resume-tex-upload/spec.md) · [design.md](../features/resume-tex-upload/design.md) · [tasks.md](../features/resume-tex-upload/tasks.md) |
| P1 | Review session recap (results + persist; history above transcript) | Validated (UAT + commits deferred) | [spec.md](../features/review-session-recap/spec.md) · [context.md](../features/review-session-recap/context.md) · [design.md](../features/review-session-recap/design.md) · [tasks.md](../features/review-session-recap/tasks.md) |
| P1 | Resume file preview (owner `GET .../file` + View on `/resumes`) | Issues (UI: Download-only vs spec View/PDF-tab; backend verified) | [spec.md](../features/resume-file-preview/spec.md) · [context.md](../features/resume-file-preview/context.md) · [tasks.md](../features/resume-file-preview/tasks.md) |

## Milestones

> Checkboxes refreshed 2026-11-06 against production (`labs.borderlesscoding.com/ai-mock-interview`). Resume preview UI remains open.

### M5 — Level-up & PWA (Q4 2026)
- [ ] Signed Hone tokens in production (AD-025)
- [ ] Every PR gated: FE + BE CI, integration/E2E, Playwright smoke
- [ ] Sentry + LangSmith in production
- [ ] PWA v1 acceptance passes on Android + iPhone

### M1 — Backend Foundation
- [x] Data model (resumes, interview_sessions, interview_messages, review_items)
- [x] R2 + BullMQ + Redis infrastructure
- [x] Resume upload & async processing (PDF + TeX — see resume-tex-upload)

### M2 — Interview Core
- [x] LangGraph agent with PostgresSaver
- [x] SSE streaming endpoint
- [x] Turn control & session finalization

### M3 — Feedback Loop
- [x] Review generator node
- [x] Review items API (read/list)
- [x] Conversation history endpoints
- [x] Async review-items generation via BullMQ (decouple from final SSE turn)

### M4 — Frontend Integration
- [x] Resume upload UI
- [ ] Resume original-file preview (`GET /api/resumes/:id/file` + View on `/resumes`) — API done; UI Needs Fix (Download-only)
- [x] Interview chat with SSE
- [x] Review list display
