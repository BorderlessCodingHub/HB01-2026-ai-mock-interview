# Quick Task 006: 404 → dashboard + persist practice turns

**Date:** 2026-08-30
**Status:** Done (practice UAT blocked on login)

## What changed

- The 404 CTA waits for auth: signed-in users get **Back to dashboard** (`/dashboard`); guests get **Back to home** (`/`).
- Practice turn count is stored in `localStorage` under `hone:interview-turns`, next to `hone:interview-level`. Values outside 3–20 are ignored.

## Files

- `frontend/src/app/not-found.tsx`
- `frontend/src/app/not-found-cta.tsx`
- `frontend/src/features/interview/lib/interview-setup-storage.ts`
- `frontend/src/app/(app)/practice/page.tsx`
- `frontend/src/app/(app)/practice/new/page.tsx`

## Verification

- Browser: guest 404 shows **Back to home** and lands on `/`. Authenticated CTA not click-tested (no session).
- `/practice` click-through not completed (no session). Persistence is the same pattern as interview level.

## Commit

- `38cbdd6` — `fix(app): send 404 guests home and signed-in users to dashboard`
- `a13acf3` — `feat(practice): persist selected turn count in localStorage`
