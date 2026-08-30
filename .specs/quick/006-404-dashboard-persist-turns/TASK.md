# Quick Task 006: 404 → dashboard + persist practice turns

**Date:** 2026-08-30
**Status:** Done (practice UAT blocked on login)

## Description

Send 404 visitors to `/dashboard` instead of the landing page, and persist the selected practice turn count in localStorage the same way interview level is persisted.

## Files Changed

- `frontend/src/app/not-found.tsx` — 404 shell
- `frontend/src/app/not-found-cta.tsx` — CTA: `/dashboard` if signed in, `/` if not
- `frontend/src/features/interview/lib/interview-setup-storage.ts` — get/set stored turns
- `frontend/src/app/(app)/practice/page.tsx` — load and persist turn count
- `frontend/src/app/(app)/practice/new/page.tsx` — same storage helpers as level

## Verification

- [x] Guest 404 CTA is `/` ("Back to home"); click lands on the landing page
- [x] Authenticated 404 CTA is `/dashboard` ("Back to dashboard") (code; session UAT blocked)
- [x] Changing turns on `/practice` writes `hone:interview-turns` (code)
- [ ] Reloading `/practice` restores the stored count (blocked: redirected to login)
- [x] `/practice/new` reads and writes the same key (code)

## Commit

- `38cbdd6` — `fix(app): send 404 guests home and signed-in users to dashboard`
- `a13acf3` — `feat(practice): persist selected turn count in localStorage`
