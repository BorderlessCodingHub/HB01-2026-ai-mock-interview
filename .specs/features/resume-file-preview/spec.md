# Resume File Preview — Specification

## Problem Statement

On `/resumes`, after upload the candidate only sees filename, date, status, Set Active, and Delete. They cannot open the file they sent. Tester feedback: *"nao consigo checar o arquivo que enviei como curriculo"*. `/profile` shows the **extracted** summary, not the original bytes. R2 is private (`AMI-DEC-05`); list/detail JSON must not grow `fileUrl` / `storageKey`. Candidates need an authenticated way to open **their** original file.

## Goals

- [ ] Authenticated **owner** can fetch original resume bytes via `GET /api/resumes/:id/file` (PDF inline; TeX attachment)
- [ ] Non-owner and unauthenticated callers never receive bytes; cross-user looks like missing (`404`), and storage is not read
- [ ] `/resumes` list has a **View** control: PDF opens in a new tab; `.tex` downloads, using `resume.name` already on the row
- [ ] Preview/detail JSON stays `{ id, name, status, createdAt }` (+ `structuredSummary` when ready) — no file URL fields

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Signed / presigned R2 URLs | `AMI-DEC-05`: bucket private; server-only get |
| `fileUrl` / `storageKey` / `sourceFormat` on list or detail JSON | RTX-DEC-11 / grill Q13; UUID in the path is enough for the client |
| Next.js BFF / cookie proxy for the file | Same Bearer `fetch` pattern as other resume APIs |
| `/resumes/[id]` detail page, sheet, or inline PDF iframe | User chose row button + new tab |
| Linking `/resumes` → `/profile` (extracted summary) | User chose **original file** only this cycle |
| Compiling `.tex` to PDF for visual preview | `resume-tex-upload`: no TeX engine |
| Changing upload, processing, delete, `RESUME_MAX_BYTES`, or `aiRateLimiter` on `POST` | Orthogonal |
| `aiRateLimiter` on this `GET` | File bytes are not an LLM call; `GET /` and `GET /:id` are already unlimited |
| Exposing `rawText` / GFM as a “preview” | Original file only |
| Range requests / streaming from R2 | Objects ≤ `RESUME_MAX_BYTES` (default 5 MiB); `IObjectStorage.get` already returns a full `Buffer` |

## Relationship to Existing Features

| Feature / code | Relevance |
| -------------- | --------- |
| [ai-mock-interview](../../backend/.specs/features/ai-mock-interview/design.md) `AMI-DEC-05` | Server-only R2; this feature **is** the client download path that decision allowed instead of signed GET |
| [resume-tex-upload](../resume-tex-upload/spec.md) | Same `storageKey` + `sourceFormat`; RTX listed “download/preview of original” as unchanged/no client URLs — this feature **adds** a dedicated byte route without putting URLs in JSON |
| `GET /api/resumes/:id`, `DELETE /api/resumes/:id` | Same auth + `findByIdAndUserId`; same `404` copy for missing **and** other-user |
| `IObjectStorage.get` | Already used by the worker; API now uses it **after** ownership |
| `/resumes` list UI | View control on each saved row; list payload unchanged |
| `/profile` | Unchanged; not the target of this feedback |

---

## Decisions (resolved in discussion)

| ID | Decision |
| -- | -------- |
| RFP-DEC-01 | User checks the **original file**, not the extracted profile |
| RFP-DEC-02 | Interaction: **View** on the list row. PDF → new tab; `.tex` → download |
| RFP-DEC-03 | `GET /api/resumes/:id/file` streams bytes; no signed URL; no new JSON fields |
| RFP-DEC-04 | Authorization is **Bearer + `findByIdAndUserId`**. Resume `id` is already UUID (`AD-008`); UUID is **not** a substitute for the owner check |
| RFP-DEC-05 | Cross-user and unknown id both return **`404` `{ "message": "Resume not found" }`** (no `403`, no existence leak). `objectStorage.get` SHALL NOT run in those cases |
| RFP-DEC-06 | Content-Type / Disposition from **server-side** `sourceFormat` (or `storageKey` suffix): PDF `inline`, TeX `attachment`. Filename = persisted `name` |
| RFP-DEC-07 | View is available for **`processing`, `ready`, and `failed`** whenever the row exists for the owner (original may still be in R2 after extraction failure) |
| RFP-DEC-08 | Frontend opens a blank tab **synchronously on click**, then navigates it to a `blob:` after authenticated `fetch` (popup blockers). Do not `<a href>` the Express origin (no Bearer) |
| RFP-DEC-09 | Success response is **raw bytes**, not JSON. `Cache-Control: private, no-store` |
| RFP-DEC-10 | R2 get failure after a successful owner lookup → **502** with a generic message; SHALL NOT include `storageKey` or provider errors |

---

## User Stories

### P1: Owner fetches original bytes ⭐ MVP

**User Story**: As an authenticated candidate, I want `GET /api/resumes/:id/file` to return the file I uploaded so I can open it in the browser or save a `.tex`.

**Why P1**: Without the API, the UI cannot show the original file; R2 is not reachable from the client.

**Acceptance Criteria**:

1. WHEN an authenticated owner `GET`s `/api/resumes/:id/file` for a resume that exists in storage THEN the system SHALL respond **200** with the object bytes
2. WHEN `sourceFormat` is `pdf` (or `storageKey` ends with `.pdf`) THEN the system SHALL set `Content-Type: application/pdf` and `Content-Disposition: inline` including the resume `name`
3. WHEN `sourceFormat` is `tex` (or `storageKey` ends with `.tex`) THEN the system SHALL set `Content-Type: text/x-tex` (or `text/plain`) and `Content-Disposition: attachment` including the resume `name`
4. WHEN the response is 200 THEN the system SHALL set `Content-Length` to the byte length and `Cache-Control: private, no-store`
5. WHEN the response is 200 THEN the body SHALL be the raw file, not JSON, and SHALL NOT include `storageKey`, `sourceFormat`, or `pdfUrl`
6. WHEN the caller is unauthenticated THEN the system SHALL respond **401** as other `/api/resumes` routes (`Authentication required`)
7. WHEN the id does not exist **or** belongs to another user THEN the system SHALL respond **404** `{ "message": "Resume not found" }` and SHALL NOT call `objectStorage.get`
8. WHEN owner lookup succeeds but `objectStorage.get` throws THEN the system SHALL respond **502** with a generic message (e.g. `Failed to fetch resume file`) and SHALL NOT leak the key or stack
9. WHEN this route is mounted THEN it SHALL NOT use `aiRateLimiter`

**Independent Test**: E2E with mocked R2: owner + seeded resume → 200, `Content-Type` pdf, `Content-Disposition` contains `inline` and original `name`, body equals `storage.get` buffer. Other user same id → 404, `get` not called. No auth → 401. Missing id → 404, `get` not called. `storage.get` rejects → 502, body JSON `message` only.

---

### P1: `/resumes` View opens the owner’s file ⭐ MVP

**User Story**: As a candidate on `/resumes`, I want a View action on each saved résumé so I can check the file I sent without leaving the list for a dead end.

**Why P1**: The feedback is about this page; API-only does not close the report.

**Acceptance Criteria**:

1. WHEN the saved-resumes list shows a row THEN the system SHALL show a **View** control (in addition to Set Active / Delete) with an accessible name that includes the resume `name`
2. WHEN the user activates View on a row whose `name` ends with `.pdf` (any ASCII case) THEN the UI SHALL `GET /api/resumes/:id/file` with the same Bearer as other resume calls, then open the PDF in a **new tab** (browser native viewer via `blob:` + `application/pdf`)
3. WHEN the user activates View on a row whose `name` ends with `.tex` (any ASCII case) THEN the UI SHALL fetch the same endpoint and **download** the file using the row `name`, not open it as a preview tab
4. WHEN View is activated THEN the UI SHALL open the target tab (or equivalent user-gesture window) **before** awaiting the network, so the popup blocker does not swallow the tab
5. WHEN the file request fails (401 / 404 / 502 / network) THEN the UI SHALL show the API `message` when present (toast, same pattern as upload errors) and SHALL NOT navigate the extra tab to a broken blob
6. WHEN the list is loading, empty, or in error THEN the system SHALL NOT show a View control on a phantom row
7. WHEN View is in flight for a row THEN that control SHALL be disabled or show a loading state so double-clicks do not open two tabs of the same fetch

**Independent Test**: On `/resumes` with at least one saved PDF: View → new tab shows the PDF. `.tex` row → file downloads as the original filename. Fail the request → toast, no stuck blank tab with garbage. Keyboard: View is reachable and named for the row.

---

## Edge Cases

- WHEN `Resume.id` is a UUID THEN the system SHALL still require `findByIdAndUserId`; guessing difficulty is not authorization
- WHEN the owner views a resume still `processing` THEN the system SHALL return the original bytes if they are in R2 (upload already succeeded)
- WHEN the owner views a `failed` resume THEN the system SHALL still attempt storage get (extraction can fail after a successful put)
- WHEN `name` contains quotes, newlines, or non-ASCII THEN `Content-Disposition` SHALL remain a valid single header (RFC 5987 `filename*` and/or a sanitized `filename`); SHALL NOT inject extra headers
- WHEN two users have different resumes THEN each SHALL only receive their own object; sharing a UUID in chat does not grant access
- WHEN the worker uses `findById` without `userId` THEN that path SHALL remain **internal**; the HTTP file route SHALL NOT reuse `findById` alone
- WHEN CORS is the frontend origin with `credentials` THEN the existing `Authorization` allowlist is sufficient; the UI uses the list `name` and response `Content-Type` (does not require `Content-Disposition` to be exposed)
- WHEN the user has popup blocking and the blank-tab open fails THEN the UI SHALL toast a short recovery message (e.g. allow popups / retry) rather than fail silently
- WHEN `GET /:id/file` is registered THEN it SHALL not be captured by `GET /:id` (more specific path)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status | Tasks |
| -------------- | ----- | ----- | ------ | ----- |
| RFP-01 | P1: Owner fetch — 200 bytes for owner | Tasks | Verified | T2, T3 |
| RFP-02 | P1: Owner fetch — PDF Content-Type + inline Disposition | Tasks | Verified | T1, T3 |
| RFP-03 | P1: Owner fetch — TeX Content-Type + attachment Disposition | Tasks | Verified | T1, T3 |
| RFP-04 | P1: Owner fetch — Content-Length + `Cache-Control: private, no-store` | Tasks | Verified | T1, T3 |
| RFP-05 | P1: Owner fetch — 200 is raw bytes; no storage keys in body/headers beyond Disposition filename | Tasks | Verified | T1, T2, T3 |
| RFP-06 | P1: Owner fetch — 401 unauthenticated | Tasks | Verified | T3 |
| RFP-07 | P1: Owner fetch — 404 missing or other user; `get` not called | Tasks | Verified | T2, T3 |
| RFP-08 | P1: Owner fetch — 502 on storage failure; generic message | Tasks | Verified | T2, T3 |
| RFP-09 | P1: Owner fetch — no `aiRateLimiter` | Tasks | Verified | T3 |
| RFP-10 | P1: UI — View on each saved row, accessible name | Tasks | ❌ Needs Fix | T6 |
| RFP-11 | P1: UI — PDF new tab via authenticated fetch + blob | Tasks | ❌ Needs Fix | T5, T6 |
| RFP-12 | P1: UI — TeX download by row `name` | Tasks | Verified | T5, T6 |
| RFP-13 | P1: UI — open window on user gesture (popup-safe) | Tasks | ❌ Needs Fix | T6 |
| RFP-14 | P1: UI — error toast; no broken blob tab | Tasks | Verified | T5, T6 |
| RFP-15 | P1: UI — no View on empty/error list; in-flight disable | Tasks | Verified | T6 |
| RFP-16 | P1: Docs — `frontend-mock-interview-api.md` documents `GET /api/resumes/:id/file` | Tasks | Verified | T4 |

**ID format:** `RFP-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified (T1–T6 executed 2026-08-29; 2026-08-29 validate: RFP-10/11/13 Needs Fix after `87784e9` replaced View/PDF-tab with download-only)

**Coverage:** 16 total, 16 mapped to tasks, 0 unmapped

---

## Success Criteria

- [ ] Owner can View a PDF from `/resumes` and see the same document they uploaded, in a new tab
- [ ] Another authenticated user with that UUID gets 404 and R2 is not read (E2E assertion on mock `get`)
- [ ] Unauthenticated `GET .../file` is 401
- [ ] List/detail JSON still has no file URL fields
- [ ] `.tex` (when present) downloads instead of rendering as a preview tab
- [ ] `frontend-mock-interview-api.md` describes the file route, headers, and 401/404/502
