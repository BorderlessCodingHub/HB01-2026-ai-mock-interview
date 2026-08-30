# Resume File Preview Context

**Gathered:** 2026-08-29
**Spec:** `.specs/features/resume-file-preview/spec.md`
**Status:** Validate 2026-08-29 — backend + docs verified; UI Needs Fix (post-T6 commit `87784e9` replaced View/PDF-tab with download-only). Browser UAT login-blocked.

---

## Feature Boundary

Authenticated owners can open the **original** résumé file from `/resumes` (PDF in a new tab, `.tex` as download) via `GET /api/resumes/:id/file`. Authorization is Bearer + `findByIdAndUserId`. R2 stays private; list/detail JSON does not grow URL fields. Extracted profile (`/profile`) is out of this cycle.

---

## Implementation Decisions

### What the user is checking

- The **original uploaded file**, not the AI-extracted summary on `/profile`
- Filename on the list is not enough; they need to open the bytes

### Interaction on `/resumes`

- **View** on the saved-resume row (not a detail page, not a sheet)
- PDF: new tab, native browser viewer
- `.tex`: download (no compiled visual preview)
- Open the tab on the click gesture, then point it at the `blob:` after fetch (popup blockers)

### API and storage

- Dedicated byte route; success is raw bytes
- No signed R2 URLs (`AMI-DEC-05`)
- No Next.js file proxy
- No `fileUrl` / `storageKey` / `sourceFormat` on existing JSON
- `aiRateLimiter` stays off this GET
- PDF `Content-Disposition: inline`; TeX `attachment`; filename from persisted `name`

### Security

- UUID on `Resume.id` already exists (`AD-008`) — reduces enumeration, **does not** authorize
- Same pattern as `GET /:id`: owner via `findByIdAndUserId`; other user → **404** not 403; `objectStorage.get` only after that lookup
- `Cache-Control: private, no-store`
- 502 on R2 failure without leaking keys

### Agent's Discretion

- Visual of the View control (icon vs text) as long as it is labeled and meets the 11px min tap target conventions of the page
- Exact 502 message wording (`Failed to fetch resume file` is the spec example)
- TeX `Content-Type` `text/x-tex` vs `text/plain` if a client cannot consume `text/x-tex`
- Sanitization details for `Content-Disposition` as long as the header is valid and includes the original name when it is a safe ASCII filename

---

## Specific References

- Tester quote: *"nao consigo checar o arquivo que enviei como curriculo"*
- User confirmed: original file only; View/Download on the row; PDF new tab; TeX download
- User confirmed: ownership check required; UUID is extra, not sufficient

---

## Deferred Ideas

- Link from `/resumes` to `/profile` for “what the AI extracted”
- `/resumes/[id]` page or in-list PDF iframe / sheet
- Signed R2 GET (rejected vs `AMI-DEC-05`)
- Next.js BFF that attaches cookies so `<a target="_blank">` hits a same-origin URL
- Compiling `.tex` to PDF for visual preview
