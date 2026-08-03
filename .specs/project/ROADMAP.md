# Roadmap

| Priority | Feature | Status | Spec |
|----------|---------|--------|------|
| P1 | Borderless Auth via better-auth | Implemented (E2E needs Docker + real Borderless JWT secret) | [spec.md](../features/borderless-better-auth/spec.md) · [context.md](../features/borderless-better-auth/context.md) · [design.md](../features/borderless-better-auth/design.md) · [tasks.md](../features/borderless-better-auth/tasks.md) |
| P1 | AI Mock Interview (backend) | Specified | [spec.md](../features/ai-mock-interview/spec.md) |
| P1 | Interview Locale (EN \| PT) | Done | [spec.md](../features/interview-locale/spec.md) · [design.md](../features/interview-locale/design.md) · [tasks.md](../features/interview-locale/tasks.md) |
| P1 | Async Review Items Generation (BullMQ) | Implemented (awaiting commit) | [spec.md](../features/async-review-items-generation/spec.md) · [design.md](../features/async-review-items-generation/design.md) · [tasks.md](../features/async-review-items-generation/tasks.md) · [context.md](../features/async-review-items-generation/context.md) |
| P2 | AI Mock Interview (frontend) | Pending | — |
| P2 | Interview Human Feedback (frontend integration) | Specified | [spec.md](../../frontend/.specs/features/interview-human-feedback/spec.md) |
| P2 | Interview Speech-to-Text (AssemblyAI batch) | Implemented (E2E/UAT/commit pending) | [spec.md](../features/interview-speech-to-text/spec.md) · [context.md](../features/interview-speech-to-text/context.md) · [design.md](../features/interview-speech-to-text/design.md) · [tasks.md](../features/interview-speech-to-text/tasks.md) |
| P2 | Study Session History (completed review sessions on `/study`) | Implemented (commit deferred) | [spec.md](../../frontend/.specs/features/study-session-history/spec.md) · [context.md](../../frontend/.specs/features/study-session-history/context.md) · [design.md](../../frontend/.specs/features/study-session-history/design.md) · [tasks.md](../../frontend/.specs/features/study-session-history/tasks.md) |
| P2 | Review Item Angles (practice variety + study reinforcement) | Implemented (awaiting commit) | [spec.md](../features/review-item-angles/spec.md) · [context.md](../features/review-item-angles/context.md) · [design.md](../features/review-item-angles/design.md) · [tasks.md](../features/review-item-angles/tasks.md) |

## Milestones

### M1 — Backend Foundation
- [ ] Data model (resumes, interview_sessions, interview_messages, review_items)
- [ ] R2 + BullMQ + Redis infrastructure
- [ ] Resume upload & async processing

### M2 — Interview Core
- [ ] LangGraph agent with PostgresSaver
- [ ] SSE streaming endpoint
- [ ] Turn control & session finalization

### M3 — Feedback Loop
- [ ] Review generator node
- [ ] Review items API (read/list)
- [ ] Conversation history endpoints
- [ ] Async review-items generation via BullMQ (decouple from final SSE turn)

### M4 — Frontend Integration
- [ ] Resume upload UI
- [ ] Interview chat with SSE
- [ ] Review list display
