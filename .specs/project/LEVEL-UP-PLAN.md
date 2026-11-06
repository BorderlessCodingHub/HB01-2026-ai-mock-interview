# Hone Level-Up Plan — Q4 2026

**Date:** 2026-11-06 · **Author:** Yuri (architect / product engineer) · **Team:** 3 devs
**Linear:** project [Hone](https://linear.app/borderless-coding/project/hone-70f11af7b8ba) · 23 issues LABS01-171…193 (created 2026-11-06, unassigned until kickoff)  
**Inputs:** [ANALYSIS-2026-11-06.md](./ANALYSIS-2026-11-06.md) · [PWA spec](../features/pwa/spec.md) · Career Forge operating model (`career-forge-v2/CLAUDE.md`)

## Outcome

In **3 weeks** Hone ships as an installable PWA with offline history, **on top of** the same delivery guardrails Career Forge has: every PR gated, every deploy automatic and observable, every decision recorded.

| # | Outcome | Measure |
|---|---------|---------|
| O1 | No known auth or data-exposure holes | PR #5 deployed; forged-token probe returns 401 in prod |
| O2 | Every PR is gated | FE + BE lint/types/unit + BE integration/E2E + Playwright smoke required on `main` |
| O3 | Production is observable | Sentry on Web/API/Worker; LangSmith traces for every interview & review graph run |
| O4 | Hone is an app | PWA v1 acceptance 1–9 pass on Android + iPhone; install funnel in PostHog |
| O5 | Docs tell the truth | One README, `CLAUDE.md`, ROADMAP/STATE current after every merge |

## Streams

Three parallel streams, one owner each. Suggested owners follow the README roles — confirm in kickoff.

| Stream | Owner (suggested) | Focus |
|--------|-------------------|-------|
| **A — Platform & gates** | Dev A · Pablo Cruz (integration, QA) | CI, Playwright, deploy pipeline, Sentry, LangSmith |
| **B — PWA** | Dev B · Vini Nathan (frontend) | PWA v1 T1–T10 |
| **C — Backend hardening & AI quality** | Dev C · Guilherme (backend, AI) | Auth rollout, API hygiene, logging, AI eval/cost gate, Push v2 design |

### Stream A — Platform & gates

| ID · Linear | Issue | Size | Class | Notes |
|----|-------|------|-------|-------|
| A1 · [LABS01-172](https://linear.app/borderless-coding/issue/LABS01-172) | Frontend CI: fix `react-hooks/refs` error in `review-session-chat.tsx`, add vitest + RTL + `test` script, `next-env.d.ts`/asset types so `check-types` passes on a clean clone, workflow: lint · types · test · `build:cloudflare` | M | **B** | Blocks PWA Phase 2. Today `main` fails FE lint and types |
| A2 · [LABS01-173](https://linear.app/borderless-coding/issue/LABS01-173) | Backend Integration/E2E on `pull_request`; find out why GitHub Actions has **zero runs** on `BorderlessCodingHub/HB01-2026-ai-mock-interview` (PR #5 ran only Workers Builds) | S | **B** | Without this, O2 is fiction |
| A3 · [LABS01-179](https://linear.app/borderless-coding/issue/LABS01-179) | Playwright smoke: login (test account) → upload resume → practice turn → feedback → study; runs on PR against preview | M | S after A1 | Gate B equivalent |
| A4 · [LABS01-180](https://linear.app/borderless-coding/issue/LABS01-180) | Branch protection on `main`: required checks A1/A2/A3, squash only, retire `dev` → `main` double merges | XS | S after A2 | |
| A5 · [LABS01-181](https://linear.app/borderless-coding/issue/LABS01-181) | Sentry: Next (Worker), Express API, BullMQ worker; release = git SHA; source maps | S | P | |
| A6 · [LABS01-182](https://linear.app/borderless-coding/issue/LABS01-182) | LangSmith: `LANGSMITH_TRACING`, project per env, run name = graph + session id | XS | P | Pairs with C4 |
| A7 · [LABS01-183](https://linear.app/borderless-coding/issue/LABS01-183) | `scripts/agent-verify.sh` + `scripts/smoke.sh` (health/ready, auth probe, manifest) | S | S after A2 | Career Forge Gate C equivalent |

### Stream B — PWA v1

See [tasks.md](../features/pwa/tasks.md) — T1 [LABS01-174](https://linear.app/borderless-coding/issue/LABS01-174), T2 [LABS01-184](https://linear.app/borderless-coding/issue/LABS01-184), T3 [LABS01-185](https://linear.app/borderless-coding/issue/LABS01-185), T4 [LABS01-186](https://linear.app/borderless-coding/issue/LABS01-186), T5 [LABS01-187](https://linear.app/borderless-coding/issue/LABS01-187), T6 [LABS01-188](https://linear.app/borderless-coding/issue/LABS01-188), T7 [LABS01-189](https://linear.app/borderless-coding/issue/LABS01-189), T8 [LABS01-191](https://linear.app/borderless-coding/issue/LABS01-191), T9 [LABS01-192](https://linear.app/borderless-coding/issue/LABS01-192), T10 [LABS01-193](https://linear.app/borderless-coding/issue/LABS01-193). Order: **T1** spike → T2/T3 → T4 → T5/T6/T7 → T8/T9 → T10.
B depends on A1 before T4 (unit tests) and on A3 before T10 (Playwright).

### Stream C — Backend hardening & AI quality

| ID · Linear | Issue | Size | Class | Notes |
|----|-------|------|-------|-------|
| C0 · [LABS01-171](https://linear.app/borderless-coding/issue/LABS01-171) | **Roll out PR #5**: set `HONE_JWT_SECRET` (Cloudflare build + runtime, Railway API + worker), deploy together, run forged-token probe in prod | XS | **B** | Day 1. Everything else assumes it |
| C1 · [LABS01-175](https://linear.app/borderless-coding/issue/LABS01-175) | Retire legacy opaque-session path (`/internal/borderless-sessions` POST, Redis session store) after 24h of PR #5 in prod; keep DELETE as logout | S | S after C0 | Shrinks attack surface |
| C2 · [LABS01-176](https://linear.app/borderless-coding/issue/LABS01-176) | API hygiene: Swagger only outside prod (or behind auth), CORS for Labs + localhost only, rate-limit `/internal/*` | XS | P | |
| C3 · [LABS01-177](https://linear.app/borderless-coding/issue/LABS01-177) | Structured logging (pino) with request id propagated to worker jobs and Sentry | S | P | |
| C4 · [LABS01-178](https://linear.app/borderless-coding/issue/LABS01-178) | AI eval & cost gate: golden interview transcripts per level, judge rubric, token/latency report per graph; run on prompt changes | M | P | Mirrors Career Forge `golden-run` / `cost-gate` |
| C5 · [LABS01-190](https://linear.app/borderless-coding/issue/LABS01-190) | **Push v2 design** (spec only): VAPID, `PushSubscription` model, `notifications` module, BullMQ triggers ("feedback ready", "quota refilled", review reminders) | S | S after PWA T4 | Spec + ADR, no code in this plan |

## Timeline

```
           Week 1                    Week 2                      Week 3
Dev A  A1 ███ A2 ██ A4 █  A5 ██  A6 █  A3 ████  A7 ██        (buffer / help B T10)
Dev B  T1 █ T2 █ T3 █ (A1 merge)  T4 ████  T5 ██ T6 ██ T7 ██   T8 █ T9 ██ T10 ███
Dev C  C0 █ C2 █ C3 ███          C1 █  C4 ██████             C5 ██ (review B)
                                                              ↑ PWA UAT on devices, release
```

Critical path: **C0 → A1 → B T4 → B T5–T7 → B T10**.

## Working agreements (adopted from Career Forge)

1. **Linear:** team Borderless Labs (`LABS01`), project **Hone**. One issue = one branch = one PR. Branch `LABS01-XX-slug`. Commit/PR title carries the key.
2. **Size:** 200–500 LOC per PR. Bigger → split.
3. **Gates before merge:** A (review: scope = one issue, structure compliance) + B (Playwright/manual UI for FE changes) + C (`agent-verify` once A7 lands). Docs-only PRs skip B/C.
4. **No deferred commits.** "Implemented (commits deferred)" is not a status. Work is done when merged and STATE.md says so.
5. **Every merge updates** `.specs/project/STATE.md` (last merge + any new AD) and ROADMAP status. Decisions keep the AD format.
6. **Specs stay the source of truth** for features (`spec / design / tasks`) — Hone's strongest habit; keep it.
7. **Secrets:** new env var = `.env.example` + deploy checklist in the PR body + both Cloudflare build and runtime when the frontend reads it.

## Kickoff agenda (45 min)

1. Analysis walkthrough — critical auth issue, gaps vs Career Forge (10)
2. Confirm stream owners and week-1 issues (10)
3. PWA spec decisions PWA-DEC-01…11 — objections now or never (15)
4. Working agreements, Linear project, branch protection date (10)
