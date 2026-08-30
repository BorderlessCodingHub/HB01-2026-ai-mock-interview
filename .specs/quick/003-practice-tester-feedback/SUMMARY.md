# Quick Task 003: Practice tester v1 feedback

**Date:** 2026-08-29
**Status:** Done (browser UAT blocked on login)

## What changed

- `/practice` "Go to Resumes" and "Upload one" now use Next.js `Link`, so production `basePath` (`/ai-mock-interview`) is prefixed.
- Chat send button stays labeled **Send** while the LLM streams. Status remains the existing "AI is responding…" line.
- Completion banner is tighter; on small screens the extra copy is hidden. After feedback is saved, the widget collapses to "Thanks for your feedback!" + Edit (still upsertable).

## Files

- `frontend/src/app/(app)/practice/page.tsx`
- `frontend/src/features/interview/interview-chat-input.tsx`
- `frontend/src/features/interview/interview-feedback-widget.tsx`
- `frontend/src/features/interview/interview-completion-banner.tsx`

## Verification

- Code: no remaining `Sending…` in `frontend/src`; practice resumes CTAs are `Link href="/resumes"`.
- Browser: `/practice` redirected to `/login` (no session). Full click-through UAT not completed.

## Commit

Deferred — await user request
