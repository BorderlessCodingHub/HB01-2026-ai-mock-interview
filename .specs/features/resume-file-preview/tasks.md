# Resume File Preview — Tasks

**Design**: skipped (same `resumes` module + existing `IObjectStorage.get`; decisions in spec/context)
**Spec**: `.specs/features/resume-file-preview/spec.md`
**Context**: `.specs/features/resume-file-preview/context.md`
**Status**: Implemented T1–T5; T6 **regressed** after `87784e9` (Download-only; PDF no longer opens in a new tab). Validate 2026-08-29: backend gates green; RFP-10/11/13 Needs Fix; browser UAT login-blocked.

**Test refs**: `backend/docs/TESTING.md`, `frontend/.specs/codebase/TESTING.md`

---

## Execution Plan

### Phase 1: Headers + docs + FE client (`[P]` where marked)

```
T1 ──────────→ Phase 2
T4 [P]
T5 [P] ──────→ Phase 4
```

### Phase 2: Service (unit)

```
T1 ──→ T2
```

### Phase 3: HTTP (e2e — not `[P]`)

```
T2 ──→ T3
```

### Phase 4: `/resumes` View

```
T5 ──→ T6
```

---

## Task Breakdown

### T1: Resume file response headers helper

**What**: Pure helpers that map `sourceFormat` + original `name` + byte length to `Content-Type`, `Content-Disposition` (PDF `inline` / TeX `attachment`), `Content-Length`, and `Cache-Control: private, no-store`.
**Where**: `backend/src/modules/resumes/resume-file-headers.ts`, `backend/src/modules/resumes/resume-file-headers.test.ts`
**Depends on**: None
**Reuses**: `resumeContentType` in `backend/src/modules/resumes/source-format.ts`; `ResumeSourceFormat` from `source-format.ts` / `resume-record.ts`
**Requirement**: RFP-02, RFP-03, RFP-04, RFP-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `buildResumeFileHeaders({ sourceFormat, name, byteLength })` returns `{ contentType, contentDisposition, contentLength, cacheControl }`
- [x] `pdf` → `application/pdf` + `Content-Disposition` includes `inline` and the name; `tex` → `text/x-tex` + `attachment`
- [x] `cacheControl` is exactly `private, no-store`; `contentLength` equals `byteLength`
- [x] Quotes, CR/LF, and `\` in `name` cannot inject extra headers; non-ASCII uses RFC 5987 `filename*` (and a sanitized ASCII `filename` fallback)
- [x] Gate check passes: `cd backend && bun run lint && bun run test -- src/modules/resumes/resume-file-headers.test.ts`
- [x] Test count: ≥5 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/resumes/resume-file-headers.test.ts`

**Commit**: `feat(resumes): add original-file response headers helper`

---

### T2: `ResumeService.getFile` with owner check

**What**: `getFile(userId, id)` loads via `findByIdAndUserId` only, then `objectStorage.get`, then T1 headers. `NotFoundError("Resume not found")` if missing/other user (no storage get). `BadGatewayError("Failed to fetch resume file")` if get throws (no key/stack in the error message).
**Where**: `backend/src/modules/resumes/service/resume-service.ts`, `backend/src/modules/resumes/service/resume-service.test.ts`
**Depends on**: T1
**Reuses**: `getResume` / `deleteResume` owner lookup; `BadGatewayError` upload-storage pattern; existing `objectStorage` mock in `resume-service.test.ts`
**Requirement**: RFP-01, RFP-05, RFP-07, RFP-08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Method does **not** call `findById` (worker-only)
- [x] Owner + mocked buffer → result includes that buffer and T1 headers for `sourceFormat` / `name`
- [x] Missing id and `findByIdAndUserId` null (other user) → `NotFoundError`; `objectStorage.get` not called
- [x] `get` rejects → `BadGatewayError` with generic message; message does not contain `storageKey`
- [x] `processing` / `failed` / `ready` all succeed if the row is found (no status gate)
- [x] Gate check passes: `cd backend && bun run lint && bun run test -- src/modules/resumes/service/resume-service.test.ts`
- [x] Test count: existing suite still passes + ≥4 new `getFile` cases (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/resumes/service/resume-service.test.ts`

**Commit**: `feat(resumes): serve original file only to the owner`

---

### T3: `GET /api/resumes/:id/file` + E2E

**What**: Controller writes T2 headers and raw bytes (not JSON). Route `GET /:id/file` **without** `aiRateLimiter`, registered before `GET /:id`. E2E covers auth, owner 200, cross-user 404 (get not called), missing 404, storage 502.
**Where**: `backend/src/modules/resumes/controller/resumes-controller.ts`, `backend/src/modules/resumes/routes/resumes-routes.ts`, `backend/src/test/e2e/resumes.e2e.test.ts`
**Depends on**: T2
**Reuses**: `resumes.e2e.test.ts` storage mock + `seedReadyResume` / `authHeader`; `asyncHandler` + `NotFoundError` / `BadGatewayError` mapping
**Requirement**: RFP-01, RFP-02, RFP-03, RFP-04, RFP-05, RFP-06, RFP-07, RFP-08, RFP-09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `GET /:id/file` is not behind `aiRateLimiter`; `POST /` still is
- [x] 200: body equals mocked buffer; `Content-Type` pdf; `Content-Disposition` has `inline` + original `name`; `Cache-Control: private, no-store`; `Content-Length` matches; body is not JSON
- [x] 401 without Bearer (same message as other resume routes)
- [x] Other user → 404 `{ "message": "Resume not found" }` and `storageMock.get` not called
- [x] Unknown id → 404, `get` not called
- [x] `storageMock.get` rejects after owner seed → 502 `{ "message": "Failed to fetch resume file" }` (or the service generic string), no `storageKey` in body
- [x] Optional: one TeX-seeded row → `attachment` + `text/x-tex` if seed helper can set `sourceFormat: tex`
- [x] Gate check passes: `cd backend && bun run test:e2e -- src/test/e2e/resumes.e2e.test.ts`
- [x] Test count: existing resume E2E still pass + ≥5 new file-route cases (no silent deletions)

**Tests**: e2e
**Gate**: full (Docker)

**Verify**:
`cd backend && bun run test:e2e -- src/test/e2e/resumes.e2e.test.ts`

**Commit**: `feat(resumes): add GET original file route`

---

### T4: Document `GET /api/resumes/:id/file` [P]

**What**: Add the file route to `frontend-mock-interview-api.md` (headers, 401/404/502, no URL fields on list/detail).
**Where**: `backend/docs/frontend-mock-interview-api.md`
**Depends on**: None (contract locked in spec)
**Reuses**: Existing Currículos section + endpoint index table
**Requirement**: RFP-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] New subsection for `GET /api/resumes/:id/file`
- [x] Documents raw bytes, PDF inline vs TeX attachment, `Cache-Control: private, no-store`, owner-only, 404 for other user (same copy as GET detail)
- [x] Index table includes the route
- [x] List/detail examples still omit `storageKey` / `sourceFormat` / `fileUrl`

**Tests**: none
**Gate**: none (markdown)

**Verify**:
Grep the doc for `/file` and `Failed to fetch resume file`.

**Commit**: `docs(resumes): document authenticated original-file GET`

---

### T5: Frontend `getResumeFile` [P]

**What**: Authenticated `GET /api/resumes/${id}/file` returning a `Blob` (throw `ApiError` on non-OK, parsing JSON `message` when present).
**Where**: `frontend/src/lib/api/resumes.ts`
**Depends on**: None (path locked in spec)
**Reuses**: `getResume` / `uploadResume` Bearer + `credentials: "include"` + `ApiError`
**Requirement**: RFP-11, RFP-12, RFP-14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Success uses `res.blob()` (not `res.json()`)
- [x] Error path matches other resume helpers (`ApiError` + `message`)
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] FE matrix: `src/lib/api/` → none

**Tests**: none
**Gate**: build (types)

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(resumes): add client getResumeFile`

---

### T6: View control on `/resumes`

**What**: View on each saved row: PDF opens a blank tab on click then navigates to `blob:` after `getResumeFile`; `.tex` (name suffix, ASCII case-insensitive) downloads via temporary `<a download={name}>`; errors toast + close extra tab; in-flight disable; `aria-label` includes `resume.name`.
**Where**: `frontend/src/app/(app)/resumes/page.tsx` (small helper in the same feature folder only if it keeps the page readable — e.g. `frontend/src/features/resumes/open-resume-file.ts`; **do not** add Vitest files: FE `check-types` has no `vitest` types in the app tsconfig)
**Depends on**: T5
**Reuses**: `getAccessToken`, `toast` / `ApiError` from upload; existing row action button classes (`size-11`, jade focus ring)
**Requirement**: RFP-10, RFP-11, RFP-12, RFP-13, RFP-14, RFP-15

**Tools**:

- MCP: NONE (browser UAT is Validate, not this task)
- Skill: NONE

**Done when**:

- [x] View is on real list rows only (not empty/error/loading placeholders) — **regressed:** control is now **Download** (`87784e9`)
- [ ] PDF: `window.open` (or equivalent) **before** `await getResumeFile`; then `blob:` with PDF type — **regressed:** always `<a download>`
- [x] `.tex` / `.TEX`: download with row `name`; do not leave a preview tab open
- [ ] Failure: toast API `message` when present; extra tab closed or not left on a broken blob; popup-blocked → short toast — toast remains; popup-blocked path gone with View
- [x] In-flight per row: control disabled or spinner; `aria-label` includes filename — `aria-label` is now `Download ${name}`
- [x] Gate check passes: `cd frontend && bun run check-types` (targeted ESLint on the page if full `bun run lint` is red on pre-existing `react-hooks/refs` — see STATE Preferences)
- [x] FE matrix: `src/app/` pages → none

**Tests**: none
**Gate**: build (types; avoid full-project lint if known-red)

**Verify**:
Grep `/resumes/page.tsx` for `getResumeFile` and `aria-label`.  
Manual UAT later: View PDF, fail network, `.tex` download.

**Commit**: `feat(resumes): add View original file on /resumes`

---

## Parallel Execution Map

```
Phase 1:
  T1          header helper (unit)
  T4 [P]      API docs
  T5 [P]      FE getResumeFile

Phase 2 (unit, same resume-service.ts as later T3 wiring):
  T1 complete → T2 getFile

Phase 3 (e2e — Docker, not parallel with other e2e agents):
  T2 complete → T3 route + E2E

Phase 4:
  T5 complete → T6 /resumes View
```

**Parallelism notes**:

- Backend **unit** is parallel-safe (T1). T2 is sequential after T1 (imports headers). T2 and T3 both touch `resume-service.ts` / controller — T3 after T2.
- **E2E** is not parallel-safe (`fileParallelism` / shared Testcontainers). T3 must not run beside another Docker e2e agent.
- T4 and T5 `[P]` vs T1: no shared files (docs vs `resumes.ts` vs new headers module).
- T6 after T5 (same page + API module). T6 does **not** depend on T3 for compile; Validate needs API up.
- Orchestrator serializes git commits (L-005). User git rule: do not commit unless asked.

---

## Validation Gates (pre-approval)

### Check 1: Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One headers module + colocated unit tests | ✅ Granular |
| T2 | One service method + colocated unit tests | ✅ Granular |
| T3 | One HTTP endpoint + E2E (controller has no unit layer) | ✅ Cohesive (matrix: controller none, HTTP = e2e) |
| T4 | One doc section | ✅ Granular |
| T5 | One client function | ✅ Granular |
| T6 | One page interaction (+ optional same-feature helper, no new test runner) | ✅ Cohesive |

### Check 2: Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | None | Phase 1 `[P]` | ✅ Match |
| T5 | None | Phase 1 `[P]` → T6 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |

T4/T5 are `[P]` and do not depend on each other. T3 is not `[P]`.

### Check 3: Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | `modules/resumes` pure helper (`service/`-adjacent; treated as unit like `validations/` / `source-format`) | unit | unit | ✅ OK |
| T2 | `service/` | unit | unit | ✅ OK |
| T3 | `controller/` + HTTP routes | controller none; HTTP e2e | e2e | ✅ OK |
| T4 | markdown docs | none | none | ✅ OK |
| T5 | `src/lib/api/` | none | none | ✅ OK |
| T6 | `src/app/` page | none | none | ✅ OK |

No “tested in another task” deferral. T3 owns the HTTP proofs for the controller it adds.

---

## Requirement mapping (spec → tasks)

| Requirement | Tasks |
| ----------- | ----- |
| RFP-01 | T2, T3 |
| RFP-02 | T1, T3 |
| RFP-03 | T1, T3 |
| RFP-04 | T1, T3 |
| RFP-05 | T1, T2, T3 |
| RFP-06 | T3 |
| RFP-07 | T2, T3 |
| RFP-08 | T2, T3 |
| RFP-09 | T3 |
| RFP-10 | T6 |
| RFP-11 | T5, T6 |
| RFP-12 | T5, T6 |
| RFP-13 | T6 |
| RFP-14 | T5, T6 |
| RFP-15 | T6 |
| RFP-16 | T4 |
