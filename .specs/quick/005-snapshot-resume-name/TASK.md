# Quick Task 005: Snapshot resume name on interview session

**Date:** 2026-08-30
**Status:** Done

## Description

Persist the CV filename on `InterviewSession` at create time so deleting a resume does not rename practice history and feedback to "Deleted resume".

## Files Changed

- `backend/prisma/schema/ai-mock-interview.prisma` — `resumeName` on `InterviewSession`
- `backend/prisma/migrations/20260830140000_interview_session_resume_name/migration.sql` — column + backfill
- `backend/src/modules/interview/repository/session-repository.ts` — persist snapshot on create
- `backend/src/modules/interview/service/session-service.ts` — copy `resume.name`; expose on summary
- `backend/src/modules/interview/service/review-generation-service.ts` — include `resumeName` on summary
- `frontend/src/types/interview.ts` — `resumeName` on `SessionSummary`
- `frontend/src/app/(app)/practice/page.tsx` — display persisted name
- `frontend/src/app/(app)/feedback/page.tsx` — display persisted name; stop joining resumes for labels
- Tests and API doc aligned with the snapshot field

## Verification

- [x] Prisma generate succeeds
- [x] Creating a session stores `resume.name` on the session
- [x] Listing/getting a session returns `resumeName`
- [x] Deleting a resume leaves `resumeName` unchanged (`resumeId` still null)
- [x] Practice and feedback UIs no longer resolve labels via resume join ("Deleted resume" removed)
- [ ] Browser click-through (blocked: login)

## Commit

`4d7d285` — feat(interview): snapshot resume name on session create
`1a8e26f` — feat(ui): show persisted resume name in practice and feedback
