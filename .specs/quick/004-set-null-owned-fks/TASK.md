# Quick Task 004: SetNull on user-owned FKs

**Date:** 2026-08-29
**Status:** Done

## Description

Deleting a resume must remove only that resume row. Deleting a practice session must keep review items, weak answers, and topic coverage (`sessionId`/`resumeId` become null).

## Files Changed

- `backend/prisma/schema/ai-mock-interview.prisma` — optional FKs + `onDelete: SetNull`
- `backend/prisma/migrations/20260830120000_owned_fks_set_null/migration.sql` — drop NOT NULL + SET NULL
- Backend records, response schemas, stream/generation services, integration tests
- Frontend session/review/weak-answer types and delete copy

## Verification

- [x] Prisma generate succeeds
- [x] Deleting a resume leaves interview sessions with `resumeId = null`
- [x] Deleting a practice session leaves review items, weak answers, and topic coverage with `sessionId = null`
- [x] Targeted unit + integration tests pass
- [ ] Browser click-through (blocked: login)

## Commit

Deferred — await user request
