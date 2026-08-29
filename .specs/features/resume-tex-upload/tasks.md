# Resume TeX Upload — Tasks

**Design**: `.specs/features/resume-tex-upload/design.md`  
**Spec**: `.specs/features/resume-tex-upload/spec.md`  
**Status**: Validated (automated 2026-08-29; browser UAT pending login; commits deferred)

**Test refs**: `backend/docs/TESTING.md`, `frontend/.specs/codebase/TESTING.md`

---

## Execution Plan

### Phase 1: Foundation (T1 sequential; others `[P]`)

T1 drops `pdfUrl` (required column). Per L-001 it **must** update every compile site in the same task so `check-types` stays green.

```
T1 ──────────→ Phase 2
T2 [P] ──────→ Phase 2
T3 [P] ──────→ Phase 3
T6 [P] ──────→ Phase 4
T8 [P]
```

### Phase 2: Upload contract (Sequential — e2e)

```
T1 + T2 ──→ T4
```

### Phase 3: Worker conversion (Sequential — unit, shared `resume-service.ts`)

```
T3 + T4 ──→ T5
```

### Phase 4: Frontend

```
T6 ──→ T7
```

---

## Task Breakdown

### T1: Prisma `ResumeSourceFormat`, drop `pdfUrl`, align repository and seeds

**What**: Add enum `ResumeSourceFormat { pdf tex }`, column `source_format` NOT NULL backfilled `pdf`, drop `pdf_url`; map `ResumeRecord` / `createProcessing` / every `pdfUrl` compile site in `backend/src`.
**Where**: `backend/prisma/schema/ai-mock-interview.prisma`, new migration `backend/prisma/migrations/YYYYMMDDHHMMSS_resume_source_format/`, `backend/src/modules/resumes/types/resume-record.ts`, `backend/src/modules/resumes/repository/resume-repository.ts`, `backend/src/test/helpers/interview-seed-helpers.ts`, all `backend/src/**` that set `pdfUrl` or call `createProcessing` (interview/review integration tests, `session-service.test.ts`)
**Depends on**: None
**Reuses**: Enum + `@map` style of `SessionQuotaKind`; existing `createProcessing` flow
**Requirement**: RTX-19

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Prisma model matches design (no `pdfUrl`; `sourceFormat ResumeSourceFormat @map("source_format")`)
- [x] Migration SQL: `CREATE TYPE "ResumeSourceFormat"`, `ADD source_format`, `UPDATE … = 'pdf'`, `SET NOT NULL`, `DROP pdf_url`
- [x] `createProcessing(userId, name, storageKey, sourceFormat, id?)` — no `pdfUrl` argument; `toResumeRecord` maps `sourceFormat`
- [x] `grep pdfUrl backend/src` (excluding `prisma/generated`) is empty
- [x] `cd backend && bun run db:generate && bun run check-types` succeeds
- [x] Gate check passes: `cd backend && bun run test:integration -- src/modules/resumes/repository/resume-repository.integration.test.ts`
- [x] Test count: existing resume-repository integration tests still pass + ≥1 asserts `sourceFormat` on create (no silent deletions)

**Tests**: integration
**Gate**: full (integration; Docker)

**Verify**:
`cd backend && bun run db:generate && bun run check-types`  
`cd backend && bun run test:integration -- src/modules/resumes/repository/resume-repository.integration.test.ts`  
`cd backend && bun run test -- src/modules/interview/service/session-service.test.ts` (fixture-only compile fix)

**Commit**: `feat(resumes): add sourceFormat and drop pdfUrl`

---

### T2: Extension classifier `source-format.ts` [P]

**What**: Pure helpers `classifyResumeSourceFormat`, `resumeStorageKey`, `resumeContentType` with unit tests.
**Where**: `backend/src/modules/resumes/source-format.ts`, `backend/src/modules/resumes/source-format.test.ts`
**Depends on**: None
**Reuses**: `RESUME_STATUS` const-array pattern in `resume-record.ts`
**Requirement**: RTX-01, RTX-02, RTX-03, RTX-06, RTX-07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `.pdf` / `.tex` suffix, ASCII case-insensitive; MIME is not an input
- [x] `CV.TEX` / `cv.TeX` → `tex`; `notes.txt` → `null`; name ending `.pdf` → `pdf`
- [x] Storage key `users/{userId}/resumes/{resumeId}.pdf|tex`; content-type `application/pdf` / `text/x-tex`
- [x] Gate check passes: `cd backend && bun run lint && bun run test -- src/modules/resumes/source-format.test.ts`
- [x] Test count: ≥6 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (targeted file; full-project `check-types` may be red until T1 lands)

**Verify**:
`cd backend && bun run test -- src/modules/resumes/source-format.test.ts`

**Commit**: `feat(resumes): classify pdf/tex by filename extension`

---

### T3: `texToMarkdown` + `pandoc-wasm@1.1.0` + Bun live test + CI [P]

**What**: Pin `pandoc-wasm@1.1.0`, lazy-dynamic-import converter, mocked Vitest tests, one real Bun WASM test, wire `test:pandoc-wasm` into CI quality and `test:all`.
**Where**: `backend/package.json`, lockfile, `backend/src/types/pandoc-wasm.d.ts`, `backend/src/infrastructure/document-parsing/tex-to-markdown.ts`, `backend/src/infrastructure/document-parsing/tex-to-markdown.test.ts`, `backend/src/infrastructure/document-parsing/tex-to-markdown.bun.test.ts`, `backend/vitest.config.ts`, `.github/workflows/backend-ci.yml`, `backend/docs/TESTING.md`
**Depends on**: None
**Reuses**: `pdf-text-extractor.ts` folder and `(buffer) => Promise<string>` shape
**Requirement**: RTX-11, RTX-15, RTX-16, RTX-17, RTX-21

**Tools**:

- MCP: `user-context7` (only if the convert API must be re-checked)
- Skill: `context7-mcp` (optional)

**Done when**:

- [x] Dependency is exact `"pandoc-wasm": "1.1.0"` (not `^`)
- [x] No static `from "pandoc-wasm"` in `tex-to-markdown.ts`; module-level promise + `import("pandoc-wasm")` on first call
- [x] `convert({ from: "latex", to: "gfm" }, utf8String, {})`; warnings/stderr are not failures; return `stdout ?? ""`
- [x] Throws `Failed to convert TeX resume` with no WASM/stack in `message`
- [x] Vitest `exclude` includes `**/*.bun.test.ts`
- [x] Script `test:pandoc-wasm` runs the bun file; `test:all` includes it; CI quality runs it after `bun run test`
- [x] Live test: `\documentclass{article}\begin{document}Jane Doe\end{document}` → GFM containing `Jane Doe`
- [x] Gate check passes: `cd backend && bun run test -- src/infrastructure/document-parsing/tex-to-markdown.test.ts && bun run test:pandoc-wasm`
- [x] Test count: ≥3 mocked unit tests + 1 bun live test pass (no silent deletions)

**Tests**: unit (+ Bun live; not in Vitest matrix)
**Gate**: quick + `bun run test:pandoc-wasm`

**Verify**:
`cd backend && rg "from \"pandoc-wasm\"" src/infrastructure/document-parsing/tex-to-markdown.ts` → no matches  
`cd backend && bun run test:pandoc-wasm`

**Commit**: `feat(resumes): convert TeX to GFM with lazy pandoc-wasm`

---

### T4: `ResumeService.upload` + controller + E2E contract

**What**: Rename `uploadPdf` → `upload`, validate by extension, persist `sourceFormat` + real storage key/content-type, generalize 400/502 copy; update controller and `resumes.e2e.test.ts`.
**Where**: `backend/src/modules/resumes/service/resume-service.ts`, `backend/src/modules/resumes/service/resume-service.test.ts` (upload describe), `backend/src/modules/resumes/controller/resumes-controller.ts`, `backend/src/test/e2e/resumes.e2e.test.ts`
**Depends on**: T1, T2
**Reuses**: Existing put/enqueue try/catch; `toResumePreview` (still no `sourceFormat`)
**Requirement**: RTX-01, RTX-02, RTX-03, RTX-04, RTX-05, RTX-06, RTX-07, RTX-08, RTX-09, RTX-20 (rename), RTX-21 (E2E)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Method is `upload`; `validateResumeFile` returns format from `classifyResumeSourceFormat`
- [x] 400s: `Resume file is required`; `Only PDF and TeX files are allowed`; service size `File must be at most ${maxBytes} bytes`
- [x] 502: `Failed to upload resume` / row `Failed to upload resume to storage`; 503 unchanged
- [x] `.tex` + any MIME → `….tex` + `text/x-tex`; `.pdf` still `application/pdf`; 201 preview has no `sourceFormat`
- [x] Controller missing-file uses the same required message; calls `upload`
- [x] Do **not** add `texToMarkdown` constructor arg yet (T5)
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/resumes/service/resume-service.test.ts && bun run test:e2e -- src/test/e2e/resumes.e2e.test.ts`
- [x] Test count: existing upload/GET/list/delete unit tests still pass + ≥2 new upload cases (TeX + spoof MIME or `.txt`); E2E POST cases still pass + TeX 201 + updated 400 copy (no silent deletions)

**Tests**: unit + e2e
**Gate**: full (e2e; Docker)

**Verify**:
E2E: attach `cv.tex` `contentType: text/plain` → 201; `storage.put` called with `…/{id}.tex` and `text/x-tex`.  
`notes.txt` → 400 `Only PDF and TeX files are allowed`. PDF 201 unchanged. No file → `Resume file is required`. GET body has no `sourceFormat`.

**Commit**: `feat(resumes): accept .tex uploads by extension`

---

### T5: `process()` dispatch + factory wiring

**What**: Inject `texToMarkdown`; PDF still uses `extractText`; TeX UTF-8 path already inside converter; shared prompt/schema; `rawText` = extractor output; empty text message unified; factory passes real `texToMarkdown`.
**Where**: `backend/src/modules/resumes/service/resume-service.ts`, `backend/src/modules/resumes/service/resume-service.test.ts` (process describe), `backend/src/factories/resumes/resume-service-factory.ts`
**Depends on**: T3, T4
**Reuses**: Existing LLM + token-usage block in `process`; `makeResumeService` composition
**Requirement**: RTX-10, RTX-11, RTX-12, RTX-13, RTX-14, RTX-15, RTX-16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Constructor takes `texToMarkdown`; factory passes `texToMarkdown` from infra (static import of the wrapper only)
- [x] `sourceFormat === "tex"` → `texToMarkdown(buffer)` only; else `extractText(buffer)` only
- [x] Empty/whitespace → `Resume contains no extractable text`, no LLM
- [x] TeX ready path persists GFM as `rawText`; prompt still `buildResumeExtractionPrompt(text)`
- [x] Converter throw message stored without stack; `TokenLimitExceededError` unchanged
- [x] Worker `concurrency` left at 1; `worker.ts` does not import `pandoc-wasm`
- [x] Gate check passes: `cd backend && bun run lint && bun run check-types && bun run test -- src/modules/resumes/service/resume-service.test.ts`
- [x] Test count: existing process tests still pass (empty-text assertion updated) + ≥2 new (TeX GFM `rawText`; PDF never calls `texToMarkdown`) (no silent deletions)

**Tests**: unit
**Gate**: quick

**Verify**:
`cd backend && bun run test -- src/modules/resumes/service/resume-service.test.ts`  
`cd backend && rg "pandoc-wasm" src/worker.ts src/factories/resumes` → factory imports `tex-to-markdown` only, not `pandoc-wasm`

**Commit**: `feat(resumes): extract TeX via GFM then existing LLM path`

---

### T6: Frontend `isAllowedResumeFile` helper [P]

**What**: Shared suffix check `.pdf` / `.tex` (case-insensitive) on `file.name`.
**Where**: `frontend/src/lib/resumes/is-allowed-resume-file.ts`
**Depends on**: None
**Reuses**: Same rule as backend `classifyResumeSourceFormat` (duplicated on purpose)
**Requirement**: RTX-18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `isAllowedResumeFile(file: File): boolean` implements the suffix rule
- [x] Gate check passes: `cd frontend && bun run check-types`
- [x] No new test runner (FE matrix: `src/lib/` → none)

**Tests**: none
**Gate**: build (types)

**Verify**:
`cd frontend && bun run check-types`

**Commit**: `feat(resumes): add client resume extension allowlist`

---

### T7: `/resumes` picker, copy, client guard + profile one-liner

**What**: Accept `.pdf`/`.tex`, format-neutral copy, reject other extensions before `uploadResume`; update profile empty-state PDF-only string.
**Where**: `frontend/src/app/(app)/resumes/page.tsx`, `frontend/src/app/(app)/profile/page.tsx`
**Depends on**: T6
**Reuses**: Existing `uploadResume`, toast, inline `uploadError`, polling/invalidation
**Requirement**: RTX-18

**Tools**:

- MCP: NONE (browser UAT is Validate, not this task)
- Skill: NONE

**Done when**:

- [x] `accept=".pdf,.tex,application/pdf"`
- [x] Empty picker states PDF and LaTeX (`.tex`) supported; selected row is filename + size (not “PDF selected”); submit is not “Upload PDF Resume”
- [x] Empty list copy is not “first PDF resume”
- [x] Disallowed extension → inline error consistent with `Only PDF and TeX files are allowed`; no POST
- [x] Profile empty-state does not say PDF-only
- [x] Gate check passes: `cd frontend && bun run check-types` (and targeted lint on the two pages if project lint is currently red elsewhere — see STATE Preferences)
- [x] FE matrix: pages → none

**Tests**: none
**Gate**: build (types; avoid full `bun run lint` if pre-existing `react-hooks/refs` failures)

**Verify**:
Grep `/resumes/page.tsx` for `accept=` and the 400-aligned reject string.  
Manual UAT later: `.tex` upload, `.txt` reject, PDF success.

**Commit**: `feat(resumes): accept TeX on /resumes upload form`

---

### T8: Update `frontend-mock-interview-api.md` [P]

**What**: Document extension-based PDF **and** TeX upload, new 400 messages, unchanged 201 preview shape (no `sourceFormat`).
**Where**: `backend/docs/frontend-mock-interview-api.md`
**Depends on**: None (copy locked in design)
**Reuses**: Existing `/resumes` section structure
**Requirement**: RTX-20

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] Overview is not “multipart PDF” only
- [x] `POST /api/resumes` says classification by **extension** `.pdf` / `.tex`; MIME is not the source of truth
- [x] Documents 400 messages from design; 201 fields unchanged; GET still omits `sourceFormat` / storage / `errorMessage`
- [x] Failed-status note does not require re-upload of PDF exclusively

**Tests**: none
**Gate**: none (markdown)

**Verify**:
Grep the doc: no “MIME: `application/pdf`” as the sole validation; 201 example has no `sourceFormat`.

**Commit**: `docs(resumes): document TeX upload by extension`

---

## Parallel Execution Map

```
Phase 1:
  T1          schema + repository sweep (integration — not [P])
  T2 [P]      classifier (unit)
  T3 [P]      pandoc-wasm converter + CI (unit + bun)
  T6 [P]      FE helper
  T8 [P]      API docs

Phase 2 (e2e — not parallel with other Docker suites):
  T1, T2 complete → T4 upload + E2E

Phase 3 (same resume-service.ts as T4):
  T3, T4 complete → T5 process + factory

Phase 4:
  T6 complete → T7 /resumes + profile
```

**Parallelism notes**:

- Backend **unit** is parallel-safe (T2, T3). **Integration** (`fileParallelism: false`) and **E2E** are not — T1 and T4 must not share an agent that runs both Docker suites, and must not overlap each other.
- T4 and T5 both edit `resume-service.ts` — sequential (T5 depends on T4).
- T3 and T5: T5 may start only after T3 (needs `texToMarkdown` export).
- FE has no runner; T6 `[P]` vs backend; T7 after T6; T8 `[P]` vs everything (docs only).
- Orchestrator serializes git commits (L-005). User git rule: do not commit unless asked.

---

## Validation Gates (pre-approval)

### Check 1: Task Granularity

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One schema change + required compile/seed sweep | ✅ Cohesive (L-001; cannot split drop-column from callers) |
| T2 | One module of pure functions | ✅ Granular |
| T3 | One infra converter + its proof/CI | ✅ Cohesive |
| T4 | One HTTP upload contract (service + controller + e2e) | ✅ Cohesive slice (one endpoint) |
| T5 | One service method + thin factory | ✅ Cohesive |
| T6 | One function | ✅ Granular |
| T7 | One page + one related copy line | ✅ Cohesive |
| T8 | One doc section | ✅ Granular |

### Check 2: Diagram ↔ Depends On

| Task | Depends On (body) | Diagram shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ |
| T2 | None | Phase 1 root `[P]` | ✅ |
| T3 | None | Phase 1 root `[P]` | ✅ |
| T4 | T1, T2 | T1+T2 → T4 | ✅ |
| T5 | T3, T4 | T3+T4 → T5 | ✅ |
| T6 | None | Phase 1 root `[P]` | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | None | Phase 1 root `[P]` | ✅ |

T5 does not list T1: T4 already requires T1 (`sourceFormat` on the record).

### Check 3: Test Co-location

| Task | Code layer | Matrix requires | Task says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | `repository/` + Prisma | integration (schema/none; repository integration) | integration | ✅ |
| T2 | pure module (validations-like) | unit | unit | ✅ |
| T3 | pure infra | unit | unit (+ bun live extra) | ✅ |
| T4 | `service/` + `controller/` + HTTP | unit + e2e (highest e2e); controller none | unit + e2e | ✅ |
| T5 | `service/` + thin factory | unit; factory none | unit | ✅ |
| T6 | `src/lib/` | none | none | ✅ |
| T7 | `src/app/` pages | none | none | ✅ |
| T8 | markdown docs | none | none | ✅ |

No test deferral: upload E2E lives in T4 with the contract change; process unit tests live in T5 with dispatch; live WASM lives in T3 with the converter.

---

## Requirement traceability (tasks)

| IDs | Tasks |
| --- | ----- |
| RTX-01, RTX-02, RTX-03 | T2, T4 |
| RTX-04, RTX-05, RTX-08, RTX-09 | T4 |
| RTX-06, RTX-07 | T2, T4 |
| RTX-10, RTX-12, RTX-13, RTX-14 | T5 |
| RTX-11, RTX-15, RTX-16, RTX-17 | T3, T5 |
| RTX-18 | T6, T7 |
| RTX-19 | T1 |
| RTX-20 | T4 (rename), T8 (docs) |
| RTX-21 | T3 (bun live), T4 (E2E), T5 (mocked process) |
