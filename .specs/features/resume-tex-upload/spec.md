# Resume TeX Upload — Specification

## Problem Statement

Candidates who keep their résumé in LaTeX cannot use Hone: `POST /api/resumes/` and `/resumes` accept only PDF. Sending raw `.tex` to the extraction LLM is a poor fit — macros, packages, and layout commands drown the signal. We need `.tex` on the existing upload path, converted to Markdown **before** the same structured-output extraction PDF already uses.

## Goals

- [ ] Authenticated users can upload a **single** `.tex` file on `POST /api/resumes/` and from `/resumes`, with the same async `processing → ready | failed` lifecycle as PDF
- [ ] TeX is converted to **GitHub-Flavored Markdown** via `pandoc-wasm` (not sent raw to the LLM); extraction prompt, schema, and `rawText` semantics match PDF
- [ ] PDF upload and processing remain unchanged in behavior (only error copy is generalized)
- [ ] Preview/detail JSON does **not** grow new fields; clients keep `{ id, name, status, createdAt }` (+ `structuredSummary` when ready)

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Multi-file LaTeX / `.zip` / Overleaf export / `\input` resolution | Grill Q2 = single `.tex`; extra files are a different product |
| `.latex` extension, `.cls` / `.sty` | Grill Q1 = `.pdf` and `.tex` only |
| Compiling LaTeX to PDF | We convert to Markdown; no TeX engine |
| Sending raw LaTeX to the LLM | Grill: source is too noisy; GFM is the extraction input |
| Separate TeX “loader” (PDFLoader analogue) | No layout/fonts/positions to resolve; convert then reuse extraction |
| Exposing `sourceFormat`, storage keys, or file bytes to the client | Grill Q13; AMI-DEC-05 server-only R2 |
| Renaming `storageKey` or introducing `fileUrl` | Grill Q7 = drop `pdfUrl`, keep `storageKey` |
| Latin-1 / `inputenc` detection | Grill Q14 = UTF-8 only |
| Extraction prompt variant for TeX | Grill Q15 = same `buildResumeExtractionPrompt` |
| Native `pandoc` binary in Docker | Grill Q3 = `pandoc-wasm` 1.1.0 in the Bun worker; native only if WASM cannot run (blocker, not this spec) |
| Eager WASM init on worker boot | Grill Q11 = lazy singleton; PDF jobs must not load WASM |
| Scanning `\input` / `\include` to fail fast | Grill Q9 = best-effort; empty GFM already fails |
| Download/preview of the original `.tex` | Unchanged: no client URLs |
| Changing `RESUME_MAX_BYTES`, auth, or `aiRateLimiter` on upload | Same gates as PDF |

## Relationship to Existing Features

| Feature / code | Relevance |
| -------------- | --------- |
| [ai-mock-interview](../../backend/.specs/features/ai-mock-interview/spec.md) AMI-02 | Resume upload + async processing; this feature extends allowed types |
| `POST /api/resumes/`, `ResumeService.uploadPdf` / `process` | Same route and job; dispatch by `sourceFormat` |
| `extractPdfText` / `PDFLoader` | Unchanged for `pdf` |
| `buildResumeExtractionPrompt` + `structuredSummarySchema` | Shared; GFM occupies the résumé-text block |
| `/resumes` upload UI | Same form; picker and copy must allow TeX |
| `backend/docs/frontend-mock-interview-api.md` | Contract still documents PDF-only; must be updated |

---

## Decisions (resolved in grill-me)

| ID | Decision |
| -- | -------- |
| RTX-DEC-01 | Classify file by **extension** (`.pdf` / `.tex`, case-insensitive). MIME is not the source of truth |
| RTX-DEC-02 | v1 = **one** `.tex` file. `\input` / `\include` without sibling files is an accepted limitation |
| RTX-DEC-03 | Convert with **`pandoc-wasm` 1.1.0** in the Bun worker (`process()`), not on the upload request. GPL accepted |
| RTX-DEC-04 | `rawText` stores the **GFM** (what the LLM saw). Original bytes stay in R2 |
| RTX-DEC-05 | Drop column `pdfUrl` / `pdf_url`. Keep `storageKey` as the R2 key (`users/{userId}/resumes/{id}.pdf\|.tex`) |
| RTX-DEC-06 | Persist **`ResumeSourceFormat { pdf, tex }`** as `sourceFormat` (`source_format`). Existing rows backfill `pdf`. R2 `Content-Type`: `application/pdf` / `text/x-tex` |
| RTX-DEC-07 | No `\input` pre-scan. Empty GFM fails like empty PDF text |
| RTX-DEC-08 | Pandoc `{ from: "latex", to: "gfm" }` |
| RTX-DEC-09 | WASM **lazy singleton** per worker process; resume queue stays `concurrency: 1` (no mutex in v1) |
| RTX-DEC-10 | Tests: mock converter in `ResumeService` tests; **one** real `pandoc-wasm` test on a minimal `.tex` (Bun gate); E2E covers upload 201 + extension rejection (queue/storage mocked as today) |
| RTX-DEC-11 | Do **not** add `sourceFormat` (or any file URL) to preview/detail JSON |
| RTX-DEC-12 | Decode `.tex` as **UTF-8** only |
| RTX-DEC-13 | Extraction prompt **unchanged** |
| RTX-DEC-14 | Generalized error copy + update `frontend-mock-interview-api.md` (see RTX-16) |
| RTX-DEC-15 | Frontend in the **same** delivery: picker `accept`, copy, and client-side extension check aligned with the API |

---

## User Stories

### P1: Upload a `.tex` résumé on the existing route ⭐ MVP

**User Story**: As a candidate, I want to POST a `.tex` file to `/api/resumes/` the same way I POST a PDF so processing starts without a second endpoint.

**Why P1**: Without the API, the UI cannot ship; this is the contract change.

**Acceptance Criteria**:

1. WHEN an authenticated user `POST`s `multipart/form-data` field `file` whose original name ends with `.tex` (any ASCII case) THEN the system SHALL accept it regardless of the declared MIME type (`text/plain`, `application/octet-stream`, `application/x-tex`, etc.)
2. WHEN the file name ends with `.pdf` (any ASCII case) THEN the system SHALL accept it as today (PDF path)
3. WHEN the file name does not end with `.pdf` or `.tex` THEN the system SHALL respond **400** with `{ "message": "Only PDF and TeX files are allowed" }` and SHALL NOT write storage or enqueue
4. WHEN no file is attached THEN the system SHALL respond **400** with `{ "message": "Resume file is required" }`
5. WHEN the file exceeds `RESUME_MAX_BYTES` THEN the system SHALL respond **400** with `{ "message": "File must be at most ${RESUME_MAX_BYTES} bytes" }` (same cap as PDF; default 5_242_880)
6. WHEN validation succeeds THEN the system SHALL create a `processing` row with `name` = original filename, `sourceFormat` derived from the extension, and `storageKey` `users/{userId}/resumes/{resumeId}.tex` or `.pdf`
7. WHEN the object is stored THEN R2 `Content-Type` SHALL be `text/x-tex` for TeX and `application/pdf` for PDF
8. WHEN enqueue succeeds THEN the system SHALL respond **201** with `{ id, name, status, createdAt }` only — SHALL NOT include `sourceFormat`, `storageKey`, `pdfUrl`, `rawText`, or `errorMessage`
9. WHEN the caller is unauthenticated THEN the system SHALL respond **401** as today
10. WHEN storage put fails THEN the system SHALL mark the row `failed` and respond **502** as today
11. WHEN enqueue fails THEN the system SHALL mark the row `failed` and respond **503** as today

**Independent Test**: E2E with mocked R2/queue: attach `cv.tex` + `contentType: text/plain` → 201, `storage.put` called with `…/{id}.tex` and `text/x-tex`. Attach `notes.txt` → 400 `Only PDF and TeX files are allowed`. Attach PDF → 201 as today. No file → 400 `Resume file is required`.

---

### P1: Convert TeX to GFM then reuse PDF extraction ⭐ MVP

**User Story**: As the platform, I want the resume worker to turn `.tex` into GFM with `pandoc-wasm` and then run the existing structured extraction so interview setup does not care how the résumé was authored.

**Why P1**: Conversion is the reason TeX is allowed; skipping it would dump raw LaTeX into the LLM.

**Acceptance Criteria**:

1. WHEN `process(resumeId)` runs for `sourceFormat = pdf` THEN the system SHALL keep using `extractPdfText` on the R2 bytes (PDFLoader path unchanged)
2. WHEN `process(resumeId)` runs for `sourceFormat = tex` THEN the system SHALL UTF-8-decode the R2 bytes and call `pandoc-wasm` `convert({ from: "latex", to: "gfm" }, texString, {})` (or equivalent documented API)
3. WHEN GFM is non-empty after trim THEN the system SHALL pass that string to `buildResumeExtractionPrompt` and `withStructuredOutput(structuredSummarySchema)` exactly as PDF text is passed today
4. WHEN extraction succeeds THEN the system SHALL persist `structuredSummary` and set `rawText` to the **GFM** (not the LaTeX source) and mark `ready`
5. WHEN GFM is empty/whitespace THEN the system SHALL mark `failed` with `errorMessage` `Resume contains no extractable text` and SHALL NOT call the LLM
6. WHEN `pandoc-wasm` throws or convert fails THEN the system SHALL mark `failed` with a clean error (no WASM/stack leak to the client) analogously to PDF parse failure
7. WHEN PDF extraction yields empty text THEN the system SHALL use the same empty-text message (`Resume contains no extractable text`) — not the old PDF-specific string
8. WHEN the worker process handles a TeX job THEN it SHALL reuse a **module-level lazy** pandoc instance; the first TeX job may pay init cost; subsequent TeX jobs SHALL NOT re-download/re-instantiate the WASM module
9. WHEN the worker handles only PDF jobs THEN it SHALL NOT instantiate `pandoc-wasm`
10. WHEN the TeX source contains `\input` or `\include` THEN the system SHALL NOT fail for that reason alone; missing siblings simply omit that content from GFM
11. WHEN `pandoc-wasm` is added THEN the dependency SHALL be **1.1.0** (exact pin)

**Independent Test**: Unit-test `process` with a fake `texToMarkdown` (mirrors mocked `extractText`). Converter module test: minimal `\documentclass{article}\begin{document}Jane Doe\end{document}` through real `pandoc-wasm` under Bun → non-empty GFM containing `Jane Doe`. Empty converter result → `failed` + no LLM. PDF fixture still calls `extractPdfText` only.

---

### P1: `/resumes` UI accepts PDF and TeX ⭐ MVP

**User Story**: As a candidate on `/resumes`, I want to pick a `.tex` file and upload it with the same form I use for PDF so I do not need a second flow.

**Why P1**: Grill Q6; API-only leaves the product blocked at the file picker (`accept="application/pdf"`).

**Acceptance Criteria**:

1. WHEN the upload control is shown THEN `accept` SHALL include `.pdf` and `.tex` (and MAY include `application/pdf`)
2. WHEN no file is selected THEN copy SHALL state that PDF and LaTeX (`.tex`) are supported — not “Only PDF files are supported”
3. WHEN a `.pdf` or `.tex` is selected THEN the UI SHALL show the filename and a type-neutral size line (not “PDF selected” only)
4. WHEN the user selects another extension THEN the UI SHALL reject it **before** calling the API and SHALL show a message consistent with `Only PDF and TeX files are allowed`
5. WHEN the user submits a valid `.tex` THEN the UI SHALL `POST` the same `file` field to `/api/resumes/` and SHALL handle 201 + processing polling as today
6. WHEN the API returns 400/502/503 THEN the UI SHALL surface `message` as today (toast + inline error)
7. WHEN the submit button label is shown THEN it SHALL not say “Upload PDF Resume” exclusively (e.g. “Upload resume”)

**Independent Test**: On `/resumes`, select a `.tex` → filename shown → upload → processing card appears. Select `.txt` → no request, error copy. Select PDF → unchanged success path.

---

### P1: Schema and docs match the new model ⭐ MVP

**User Story**: As a developer, I want `pdfUrl` gone, `sourceFormat` on the row, and the published API doc to describe PDF **and** TeX so tests and clients do not lie.

**Why P1**: Worker dispatch and storage keys depend on the column; E2E and `frontend-mock-interview-api.md` still encode PDF-only strings.

**Acceptance Criteria**:

1. WHEN the Prisma migration runs THEN column `pdf_url` SHALL be dropped and `source_format` SHALL exist as enum `pdf | tex`, `NOT NULL`
2. WHEN existing resume rows are migrated THEN `source_format` SHALL be `pdf` for all backfilled rows and `storage_key` SHALL be unchanged
3. WHEN application code maps a resume THEN it SHALL NOT read or write `pdfUrl`
4. WHEN `backend/docs/frontend-mock-interview-api.md` describes `POST /api/resumes` THEN it SHALL document `.pdf` and `.tex` by **extension**, the new 400 messages, and unchanged 201 preview shape
5. WHEN `ResumeService` method names / comments imply PDF-only upload THEN they SHALL be generalized (e.g. `upload` / `validateResumeFile`) so callers are not PDF-shaped

**Independent Test**: `prisma migrate` against a DB with a PDF resume → row has `source_format = pdf`, no `pdf_url`. Grep `pdfUrl` in `backend/src` → no production references. Doc section no longer says MIME-only PDF validation.

---

## Edge Cases

- WHEN the filename is `CV.TEX` or `cv.TeX` THEN the system SHALL treat it as TeX
- WHEN a `.tex` upload sends `Content-Type: application/pdf` (spoof) THEN the system SHALL still treat it as TeX **by extension** and run pandoc, not PDFLoader
- WHEN a `.pdf` upload sends `text/plain` THEN the system SHALL still treat it as PDF **by extension**
- WHEN GFM is non-empty but extraction retries exhaust THEN the system SHALL mark `failed` with the existing clean LLM error (unchanged token/retry behavior)
- WHEN token limit is exceeded during TeX extraction THEN the system SHALL mark `failed` with `TokenLimitExceededError` message as today
- WHEN `pandoc-wasm` emits warnings but non-empty `stdout` THEN the system SHALL proceed with `stdout` (warnings are not a failure)
- WHEN custom classes (`moderncv`, Awesome CV) produce poor GFM THEN the system SHALL still extract best-effort (no special-case failure)
- WHEN Latin-1 `.tex` decodes as UTF-8 mojibake THEN the system SHALL still send that string to pandoc / LLM (no encoding fallback)
- WHEN two TeX jobs run in sequence on the same worker THEN the second SHALL reuse the lazy pandoc instance
- WHEN resume worker `concurrency` is later raised above 1 THEN this spec does **not** require a mutex; that is a follow-up (current worker is `concurrency: 1`)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| RTX-01 | P1: Upload — accept `.tex` by extension, ignore MIME | Execute | Verified |
| RTX-02 | P1: Upload — accept `.pdf` by extension | Execute | Verified |
| RTX-03 | P1: Upload — 400 `Only PDF and TeX files are allowed` | Execute | Verified |
| RTX-04 | P1: Upload — 400 `Resume file is required` | Execute | Verified |
| RTX-05 | P1: Upload — 400 `File must be at most N bytes` | Execute | Verified |
| RTX-06 | P1: Upload — persist `sourceFormat` + `storageKey` with real extension | Execute | Verified |
| RTX-07 | P1: Upload — R2 Content-Type derived | Execute | Verified |
| RTX-08 | P1: Upload — 201 preview unchanged (no `sourceFormat`) | Execute | Verified |
| RTX-09 | P1: Upload — 401 / 502 / 503 unchanged | Execute | Verified |
| RTX-10 | P1: Convert — PDF still uses `extractPdfText` | Execute | Verified |
| RTX-11 | P1: Convert — TeX UTF-8 → `pandoc-wasm` latex→gfm | Execute | Verified |
| RTX-12 | P1: Convert — GFM into existing prompt + structured output | Execute | Verified |
| RTX-13 | P1: Convert — `rawText` is GFM | Execute | Verified |
| RTX-14 | P1: Convert — empty GFM / empty PDF text → `Resume contains no extractable text` | Execute | Verified |
| RTX-15 | P1: Convert — pandoc failure → `failed`, no stack leak | Execute | Verified |
| RTX-16 | P1: Convert — lazy WASM singleton; PDF jobs do not init WASM | Execute | Verified |
| RTX-17 | P1: Convert — no `\input` scan; pin `pandoc-wasm@1.1.0` | Execute | Verified |
| RTX-18 | P1: UI — accept, copy, client-side extension check, same POST | Execute | Verified (code + types; browser UAT pending login) |
| RTX-19 | P1: Schema — drop `pdf_url`, add `source_format`, backfill `pdf` | Execute | Verified |
| RTX-20 | P1: Schema — docs + rename PDF-only upload API in code | Execute | Verified |
| RTX-21 | P1: Convert — real Bun `pandoc-wasm` extractor test + mocked service tests + E2E upload | Execute | Verified |

**ID format:** `RTX-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 21 total, 21 mapped to tasks (see `tasks.md`), 0 unmapped

---

## Success Criteria

- [ ] A user can upload `cv.tex` from `/resumes` and reach `ready` with a structured summary (or `failed` with a clear message if GFM/extraction fails)
- [ ] PDF upload and extraction still succeed on the same route and worker
- [ ] Browser MIME `text/plain` on a `.tex` file does **not** 400
- [ ] `GET` resume preview never includes `sourceFormat` or storage keys
- [ ] `rawText` for TeX resumes is Markdown, not LaTeX
- [ ] `frontend-mock-interview-api.md` and E2E messages match the new 400 copy
- [ ] CI has a Bun test that actually runs `pandoc-wasm` on a fixture `.tex`
