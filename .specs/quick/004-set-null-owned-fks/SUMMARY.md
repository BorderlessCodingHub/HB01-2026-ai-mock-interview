# Quick Task 004 — Summary

**Status:** Done (commit deferred)

Deleting a CV now removes only the resume row. Deleting a practice session keeps review items, weak answers, and topic coverage; their `sessionId` is set to null. Interview messages and feedback still go with the practice session.

## Verification

- Backend `tsc --noEmit` passed
- 100 unit tests passed (stream, session, review generation, weak-answer generation, schemas)
- 29 integration tests passed (`session-repository`, `resume-repository`) including the new SetNull cases
- Related review/weak-answer/coverage integration tests passed (18)
- Migration `20260830120000_owned_fks_set_null` applied to local Postgres

## Commit

Deferred — await user request
