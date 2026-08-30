# Quick Task 005 — Summary

**Status:** Done (commit deferred)

Interview sessions now store a snapshot of the CV filename at create time. Deleting a resume still nulls `resumeId` (AD-023) but `/practice` and `/feedback` keep showing the original name instead of "Deleted resume".

## Verification

- Backend `tsc --noEmit` passed
- 70 unit tests passed (session, stream, review generation, weak-answer, coverage, feedback)
- 29 integration tests passed (`session-repository`, `resume-repository`) including resume delete keeping `resumeName`
- E2E: list sessions includes `resumeName`; delete resume leaves `resumeName` and `resumeId: null`
- Migration `20260830140000_interview_session_resume_name` applied to local Postgres

## Commit

`4d7d285` — feat(interview): snapshot resume name on session create
`1a8e26f` — feat(ui): show persisted resume name in practice and feedback
