# Testing Guide

This project uses a **three-suite Vitest pyramid**: unit (fast, no Docker), integration (real PostgreSQL via Testcontainers), and E2E (HTTP + PostgreSQL + Redis via Testcontainers).

---

## Layer → Test Type

| Code layer | Test type | File suffix | Runner |
|------------|-----------|-------------|--------|
| `validations/`, `service/`, `middlewares/`, pure infra | **Unit** | `*.test.ts` | `bun run test` |
| `repository/` | **Integration** | `*.integration.test.ts` | `bun run test:integration` |
| HTTP routes (Express + supertest) | **E2E** | `*.e2e.test.ts` | `bun run test:e2e` |
| `controller/` | **None** — covered by E2E | — | — |
| Thin wrappers (e.g. checkpoint singleton) | **None** | — | — |
| `prompts/`, pure LangGraph helpers | **Unit** | `*.test.ts` | `bun run test` |
| `document-parsing/` live WASM (`texToMarkdown`) | **Bun live** (not Vitest) | `*.bun.test.ts` | `bun run test:pandoc-wasm` |

Pre-commit runs **unit tests only** (plus lint) — no Docker, no `test:pandoc-wasm`. See [CI vs Husky vs local](#ci-vs-husky-vs-local) for the full matrix.

---

## Commands

| Command | Scope | Docker required |
|---------|-------|-----------------|
| `bun run test` | Unit tests | No |
| `bun run test:pandoc-wasm` | Real `pandoc-wasm` TeX→GFM (not Vitest) | No |
| `bun run test:integration` | Repository integration | Yes |
| `bun run test:e2e` | HTTP E2E suites | Yes |
| `bun run test:all` | Unit + pandoc-wasm live + integration + E2E | Yes |
| `bun run test:watch` | Unit watch mode | No |
| `bun run test:coverage` | Unit tests + V8 coverage report | No |

Run a single file:

```bash
bun run test -- src/modules/auth/validations/auth-schemas.test.ts
bun run test:integration -- src/modules/auth/repository/user-repository.integration.test.ts
bun run test:e2e -- src/test/e2e/auth.e2e.test.ts
```

---

## CI vs Husky vs local

Three contexts run checks at different depth. Use this table to see what runs where:

| Context | When | Lint | Types | Unit | Integration / E2E | Docker |
|---------|------|------|-------|------|-------------------|--------|
| **CI — quality** ([`backend-ci.yml`](../../.github/workflows/backend-ci.yml)) | PR + push to `main` / `master` | Yes | Yes | Yes + pandoc-wasm live | No | No |
| **CI — integration/E2E** ([`backend-integration-e2e.yml`](../../.github/workflows/backend-integration-e2e.yml)) | Push to `main` or manual | No | No | No | Yes | Yes (runner) |
| **Husky** (`.husky/pre-commit`) | Every commit | Yes | No | Yes (unit only; no pandoc-wasm live) | No | No |
| **Local quick** | Before push (recommended) | Yes | Yes | Yes | No | No |
| **Local full** | Before release or risky test changes | — | — | Yes | Yes (`test:all`) | Yes |

### GitHub Actions: Backend CI

Workflow file (repo root): [`.github/workflows/backend-ci.yml`](../../.github/workflows/backend-ci.yml).

- **Triggers**: `pull_request`; `push` to `main` or `master`
- **Job**: `quality` on `ubuntu-latest`, `working-directory: backend`, `NODE_ENV=test`, dummy `DATABASE_URL` for `prisma generate` on install (no `.env` in CI)
- **Steps** (in order):
  1. Checkout
  2. Setup Bun (`oven-sh/setup-bun@v2`)
  3. `bun install`
  4. `bun run lint`
  5. `bun run check-types`
  6. `bun run test` (unit suite only)
  7. `bun run test:pandoc-wasm` (real WASM TeX→GFM under Bun)

PR **quality** CI does **not** run integration or E2E (no Docker on that job). It **does** run the pandoc-wasm live test after unit tests. Use `bun run test:all` locally before release (or when changing repositories, routes, or Testcontainers setup).

### GitHub Actions: Backend Integration & E2E

Workflow file (repo root): [`.github/workflows/backend-integration-e2e.yml`](../../.github/workflows/backend-integration-e2e.yml).

- **Triggers**: `push` to `main` only; `workflow_dispatch` (manual)
- **Job**: `integration-e2e` on `ubuntu-latest` (Docker available), `working-directory: backend`, `timeout-minutes: 30`, `NODE_ENV=test`
- **Steps** (in order):
  1. Checkout
  2. Setup Bun (`oven-sh/setup-bun@v2`)
  3. `bun install`
  4. `bun run test:integration`
  5. `bun run test:e2e`

This is an **optional / main gate**: it does not run on every PR, only after merge to `main` (or when triggered manually). Run `bun run test:all` locally before relying on this workflow — same suites, faster feedback.

### Pre-commit (Husky)

`.husky/pre-commit` runs:

```bash
bun run lint && bun run test
```

Unit tests only — no `check-types`, no Docker, no `test:pandoc-wasm`. Keeps commits fast while catching lint and unit regressions.

### Local gates

**Quick gate** (matches CI — run from `backend/` at monorepo root):

```bash
bun run lint && bun run check-types && bun run test
```

**Full gate** (before release):

```bash
bun run test:all
```

Runs unit, then pandoc-wasm live, then integration, then E2E in sequence. Requires Docker Desktop (or Engine).

### Coverage (local only)

```bash
bun run test:coverage
```

Runs the unit suite with `@vitest/coverage-v8` and prints a text summary. An HTML report is written to `coverage/` (gitignored). Coverage is **not** run in CI and has no enforced threshold — use it locally to spot untested code.

---

## Prerequisites

- **Bun** — test runner and runtime
- **Docker Desktop** (or Docker Engine) — required for `test:integration` and `test:e2e`
- Testcontainers pulls `postgres:16-alpine` and `redis:8-alpine` on first run (may take a minute)

---

## File Conventions

| Suffix | Location | Notes |
|--------|----------|-------|
| `*.test.ts` | Colocated with source | Mocked dependencies; excluded from integration/E2E configs |
| `*.bun.test.ts` | Colocated with source | Real `pandoc-wasm` under Bun; excluded from Vitest (`exclude` includes `**/*.bun.test.ts`) |
| `*.integration.test.ts` | Colocated with repository | Real DB; `resetDatabase()` in `afterEach` |
| `*.e2e.test.ts` | `src/test/e2e/` | Full app via `createApp()` + supertest |

Shared test infrastructure lives under `src/test/`:

```
src/test/
├── containers/          # Testcontainers globalSetup, migrate, truncate, inject-env
├── integration/       # resetDatabase / disconnectDatabase helpers
├── helpers/           # auth-helpers, seed helpers for E2E
└── mocks/             # bun password mock, etc.
```

---

## Unit Test Example

```typescript
import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth-schemas";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });
});
```

Unit config (`vitest.config.ts`) excludes `*.integration.test.ts`, `*.e2e.test.ts`, and `*.bun.test.ts`. The `bun:` alias mocks Bun's password API for bcrypt tests.

---

## Integration Test Example

```typescript
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  disconnectDatabase,
  resetDatabase,
} from "@/test/integration/helpers";
import { UserRepository } from "./user-repository";

describe("UserRepository (integration)", () => {
  const repository = new UserRepository();

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("create + getByEmail round-trip", async () => {
    const created = await repository.create({
      name: "Jane",
      email: "jane@test.com",
      password: "hashed-password",
    });

    const found = await repository.getByEmail("jane@test.com");
    expect(found).toMatchObject({ id: created.id, email: "jane@test.com" });
  });
});
```

Integration suite starts a PostgreSQL container in `globalSetup`, runs Prisma migrations, and injects `DATABASE_URL` into workers via Vitest `inject()`. Tests share one container per run (`fileParallelism: false`); `truncateTables()` isolates each test.

---

## E2E Test Example

```typescript
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "@/config/app";
import { truncateTables } from "@/test/containers/truncate-tables";
import { signUpUser, loginUser, authHeader } from "@/test/helpers/auth-helpers";

describe("My API E2E", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  it("returns 401 without auth", async () => {
    const response = await request(app).get("/api/my-route");
    expect(response.status).toBe(401);
  });
});
```

E2E suite starts PostgreSQL + Redis containers. External services (nodemailer, LangGraph, R2, BullMQ) are mocked with `vi.mock()` at the top of each suite. `inject-env.setup.ts` must run before any import of `@/infrastructure/database`.

---

## Bootstrap Flow (integration / E2E)

1. **globalSetup** (main process): start containers → `runMigrations()` → `project.provide("databaseUrl", uri)`
2. **inject-env.setup.ts** (worker): `process.env.DATABASE_URL = inject("databaseUrl")`
3. **vitest.setup.ts**: default env vars (only if unset)
4. Test file imports Prisma singleton (uses injected URL)
5. **afterEach**: `truncateTables()` for isolation
6. **teardown**: stop containers

---

## Local Dev: Container Reuse (optional)

By default containers are **ephemeral** (started/stopped each run). For faster local iteration you can enable reuse in globalSetup:

```typescript
new PostgreSqlContainer(POSTGRES_IMAGE)
  .withReuse()
  // ...
```

Reuse is **not enabled in CI** — keep it as a local-only optimization documented here.

---

## Mocking Guidelines

| Service | Unit | Integration | E2E |
|---------|------|-------------|-----|
| PostgreSQL | Mock Prisma | Real (Testcontainers) | Real (Testcontainers) |
| Redis | N/A | N/A | Real (Testcontainers) |
| OpenAI / LangGraph | Mock | N/A | `vi.mock` graph factory |
| Nodemailer | Mock transport | N/A | `vi.mock("nodemailer")` |
| R2 storage | Mock | N/A | `vi.mock` r2-client |
| BullMQ | Mock | N/A | `vi.mock` resume-queue |
| `aiRateLimiter` store | Injected `MemoryStore` (never `RedisStore`) | N/A | Real `RedisStore` (same Testcontainers Redis as BullMQ) |

### AI rate limiting (`aiRateLimiter`)

`aiRateLimiter` (wired via `makeAiRateLimiter()` from `@/factories/shared/ai-rate-limiter-factory`) keys counters by **`req.userId`**, not client IP — two users behind the same IP each get independent quotas.

- **Unit** (`rate-limit-middleware.test.ts`): test `aiRateLimitKeyGenerator` and `makeAiRateLimiter(store)` with an injected **`MemoryStore`** from `express-rate-limit`. Do not use a real **`RedisStore`** in unit tests; Redis/Lua script behavior is validated in E2E only.
- **E2E** (`interview.e2e.test.ts`, `resumes.e2e.test.ts`): the factory's `RedisStore` uses the **same Testcontainers Redis** already started for BullMQ (no extra container). Tests temporarily set `RATE_LIMIT_AI_MAX` / `RATE_LIMIT_AI_WINDOW_MS` inside `describe("AI rate limiting")` blocks.

---

## AI quality metrics

Business definitions for turn-limit adherence, closing-feedback format, and retry-exhaustion rate (log query fields, formulas, data sources) are documented in [`ai-quality-metrics.md`](./ai-quality-metrics.md). Automated quality tests under `src/test/quality/` will implement rule-based evaluators referenced there.

---

## Scenario coverage

Expanded HTTP and repository scenarios are tracked in [`.specs/features/test-scenario-coverage/spec.md`](../.specs/features/test-scenario-coverage/spec.md). Summary by module:

| Module | E2E file | New scenario groups |
|--------|----------|---------------------|
| Auth | `auth.e2e.test.ts` | Bearer malformed/invalid (401), login/request-reset/reset-password 422, refresh 401 |
| Interview | `interview.e2e.test.ts` | Resume processing/failed/404, session/messages/stream auth & 404/409/422 |
| Resumes | `resumes.e2e.test.ts` | Upload validation (no file, non-PDF, size), GET 401, storage 502, queue 503 |
| Review items | `review-items.e2e.test.ts` | Empty list, cross-user isolation |

Unit additions: `validation-middleware.test.ts`, `review-items-generator-prompt.test.ts`, `closing-feedback-prompt.test.ts`.

Integration additions: `SessionRepository.incrementTurnCount` / `markFinished`, `ReviewRepository` topic lookups (case + `pg_trgm` similarity), null/empty cases on user/resume/message repos.

E2E uses `RATE_LIMIT_MAX=500` in `vitest.e2e.setup.ts` (overrides `.env`) so auth-heavy suites do not hit the default 20 req/window limit.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Cannot connect to Docker` | Docker not running | Start Docker Desktop |
| Tests hang on startup | Image pull / slow container | Wait; first run pulls images (~1–2 min) |
| Wrong DATABASE_URL in tests | Import order | Ensure `inject-env.setup.ts` is first in `setupFiles` |
| FK errors on truncate | Missing CASCADE | Use `truncateTables()` helper |
| E2E calls real OpenAI | Missing mock | Add `vi.mock` for graph/LLM factory |
| E2E auth returns 429 | Low `RATE_LIMIT_MAX` in `.env` | E2E setup forces 500; ensure `vitest.e2e.setup.ts` runs |
