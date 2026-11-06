# Hone — Claude Code context

**Hone** — AI mock interview for software engineers: resume-aware practice interviews (SSE), closing feedback, study backlog and review sessions.

Borderless Labs · `labs.borderlesscoding.com/ai-mock-interview` · Linear team **Borderless Labs** (`LABS01`) · project **Hone** · plan: [LEVEL-UP-PLAN.md](./.specs/project/LEVEL-UP-PLAN.md)

## Stack

```
frontend/   Next.js 16 App Router (Turbopack), React 19, Tailwind v4, TanStack Query, better-auth
            → Cloudflare Workers via OpenNext, basePath /ai-mock-interview (prod only)
backend/    Bun, Express 5, Prisma 7, Zod env (t3-env), BullMQ worker
            → Railway (API + worker)
AI          LangChain JS + LangGraph JS, PostgresSaver checkpoints, OpenAI, AssemblyAI (STT)
Data        PostgreSQL, Redis (BullMQ, rate limits, token revocation), Cloudflare R2 (resumes)
```

## Repo structure

```
backend/src/
  index.ts / worker.ts     API and BullMQ worker entrypoints
  config/                  app.ts (CORS, Swagger, health), routes.ts (auto-discovery), env/
  factories/               composition root — the only place that wires `new`
  modules/{name}/          routes → controller → service → repository; validations, protocols, prompts
  infrastructure/          ai/ (langgraph, checkpoint), database, queue, storage, document-parsing
  shared/                  adapters, errors, middlewares, utils (SSE helpers)
  test/                    containers, e2e, integration, helpers, quality
frontend/src/
  app/(app)/               dashboard, practice, interview/[id], feedback, study, review-session, resumes, profile
  features/                domain UI + hooks (auth, interview, study, dashboard, pwa…)
  lib/api/                 fetch clients + SSE readers;  lib/query/ hooks + keys
.specs/                    project (PROJECT, ROADMAP, STATE, ANALYSIS, LEVEL-UP-PLAN) + features/{name}/{spec,design,tasks}
```

## Commands

| Where | Command | When |
|-------|---------|------|
| backend | `bun run dev` / `bun run dev:worker` | API :3000 / worker |
| backend | `bun run lint && bun run check-types && bun run test` | Before every PR |
| backend | `bun run test:integration` / `test:e2e` | Needs Docker (Testcontainers) |
| backend | `bunx prisma migrate dev` | Schema change |
| frontend | `bun run dev` | Web :3001 (no basePath) |
| frontend | `bun run lint && bun run check-types` | Before every PR |
| frontend | `bun run build:cloudflare` / `bun run preview` | Verify Workers build with basePath |

Local infra: Postgres + Redis via `bun run db:start` (Docker) or Homebrew services; R2 via MinIO (`R2_ENDPOINT=http://127.0.0.1:9000`).

---

## Rules

### Delivery

- Linear issue first. Branch `LABS01-XX-slug`. One issue = one branch = one PR, 200–500 LOC, squash to `main`.
- Commit/PR titles carry the issue key. PR body has **Why / What / Deploy / Verification**.
- **No deferred commits.** Done = merged + `STATE.md` updated (last merge, new AD if any) + ROADMAP status.
- Gates: code review + a UI check for frontend changes (Playwright once A3 lands). Docs-only: review only.
- New env var → `.env.example` + PR **Deploy** section. Frontend server vars must be set in Cloudflare **build** variables *and* runtime (t3-env validates during `next build`).

### Specs

- Feature work starts from `.specs/features/{name}/spec.md` (Problem, Goals, Out of Scope, Decisions with IDs, Requirements) → `design.md` → `tasks.md`.
- Decisions go to `STATE.md` as `AD-NNN` with Decision / Reason / Trade-off / Impact.

### Backend architecture

1. Modules follow `routes → controller → service → repository`; controllers stay thin (`asyncHandler`), Zod at the edges.
2. Wire dependencies only in `src/factories/`. Depend on `protocols/` interfaces in services.
3. Ownership comes from `req.userId` (auth middleware) — never from body or params.
4. Env goes through `config/env` (t3-env + Zod). No `process.env` reads elsewhere.
5. Long or retryable LLM work runs in BullMQ jobs, not in the request.

### Auth (AD-025)

- The Next server checks Borderless credentials and mints a **Hone access token** (HS256, `iss=hone-web`, `aud=hone-api`, `jti`, `exp ≤ 24h`, `HONE_JWT_SECRET`).
- The API accepts only tokens that pass `jwt.verify` with that secret, issuer and audience. Logout revokes the `jti` in Redis.
- ❌ Never `jwt.decode` a Bearer token for identity. ❌ Never trust claims from an upstream token without a signature check.

### AI / streaming

- LangGraph graphs live in `infrastructure/ai/langgraph/`; prompts in `modules/*/prompts/` with tests; catalog in `backend/docs/prompts-catalog.md`.
- SSE helpers only in `shared/utils` (server) and `lib/api/sse-stream.ts` (client). No per-feature stream parsers.
- Count tokens through `token-usage`; respect `session-quota` and `aiRateLimiter`.

### Frontend

- Data via TanStack Query hooks in `lib/query/hooks` with keys from `lib/query/keys.ts`.
- `fetchWithAuth` signs out **only** on HTTP 401 — never on network errors.
- App is light-only (forced theme). Shared origin with other Labs apps: prefix any storage key, cache or IndexedDB name with `hone-`.
- PWA work follows [.specs/features/pwa](./.specs/features/pwa/spec.md): the service worker never intercepts cross-origin, `/api/auth/*`, non-GET or `text/event-stream`.

### Debugging

1. `curl localhost:3000/health/ready` → DB + Redis status.
2. API/worker logs in their terminals; env validation errors name the missing variable.
3. CORS: `CORS_ORIGIN` must equal the web origin (`http://localhost:3001`).
4. Auth 401s: `HONE_JWT_SECRET` must match between `backend/.env` and `frontend/.env.local`.
5. No mock fallbacks — fix the real dependency.

## Session bootstrap

Read in order: this file → [STATE.md](./.specs/project/STATE.md) → [ROADMAP.md](./.specs/project/ROADMAP.md) → [LEVEL-UP-PLAN.md](./.specs/project/LEVEL-UP-PLAN.md) → the feature's `.specs/features/{name}/` → the Linear issue.
