# Quick Task 003: Practice tester v1 feedback

**Date:** 2026-08-29
**Status:** Done (browser UAT blocked on login)

## Description

Fix three `/practice` issues from v1 testers: resumes CTA ignores Next `basePath`, send button says "Sending..." while the LLM is generating, and the post-session feedback block crowds the chat on small screens.

## Files Changed

- `frontend/src/app/(app)/practice/page.tsx` — use Next.js `Link` for `/resumes` so `basePath` is prefixed
- `frontend/src/features/interview/interview-chat-input.tsx` — stop labeling the send button as "Sending..." during AI generation
- `frontend/src/features/interview/interview-feedback-widget.tsx` — compact the form; collapse after feedback is saved
- `frontend/src/features/interview/interview-completion-banner.tsx` — tighten banner copy and padding

## Verification

- [x] "Go to Resumes" and "Upload one" use `Link` to `/resumes` (respects `basePath`)
- [x] While the AI is streaming, the send button does not say "Sending..."
- [x] After feedback is submitted, the completion block collapses to a compact confirmation
- [x] Before submit, the feedback form is smaller than before (less padding, shorter textarea)
- [ ] Browser click-through on `/practice` (blocked: redirected to login)

## Commit

Deferred — await user request
