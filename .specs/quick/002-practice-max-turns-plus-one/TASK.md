# Quick Task 002: Practice maxTurns +1 for auto ready message

**Date:** 2026-08-04
**Status:** Done

## Description

Bump `MAX_TURNS_BY_LEVEL` by +1 so the automatic ready message that starts the interview does not consume one of the intended user answer turns (entry 5→6, mid 7→8, senior 8→9).

## Files Changed

- `backend/src/modules/interview/repository/session-repository.ts` — `MAX_TURNS_BY_LEVEL` +1
- `backend/src/modules/interview/repository/session-repository.integration.test.ts` — expected values
- `backend/src/modules/interview/service/session-service.test.ts` — expected values
- `backend/src/test/e2e/interview.e2e.test.ts` — list/get session maxTurns assertions

## Verification

- [x] Unit tests for session-service pass with new maxTurns map
- [ ] New entry session allows 5 user answers after auto ready (manual UAT)
- [ ] Labels on `/practice` still show 5/7/8 as intended user answer counts

## Commit

Deferred — await user request
