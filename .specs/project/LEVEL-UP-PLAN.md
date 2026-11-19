# Hone — Q4 2026 plan

**Linear:** project [Hone](https://linear.app/borderless-coding/project/hone-70f11af7b8ba) · 3 devs · owners confirmed at kickoff

## Goal

Ship a better interview experience and an installable app, on top of a safe, gated codebase.

## Streams

| Stream | Owner (suggested) | Issues |
|---|---|---|
| **Platform** | Pablo | C0 [171](https://linear.app/borderless-coding/issue/LABS01-171) auth rollout · A1 [172](https://linear.app/borderless-coding/issue/LABS01-172) frontend CI · A2 [173](https://linear.app/borderless-coding/issue/LABS01-173) backend CI + protect main · A3 [179](https://linear.app/borderless-coding/issue/LABS01-179) Playwright smoke · A5 [181](https://linear.app/borderless-coding/issue/LABS01-181) Sentry · C2 [176](https://linear.app/borderless-coding/issue/LABS01-176) API cleanup |
| **Interview UI** | Guilherme | [194](https://linear.app/borderless-coding/issue/LABS01-194) question-first layout · [195](https://linear.app/borderless-coding/issue/LABS01-195) room to answer · [196](https://linear.app/borderless-coding/issue/LABS01-196) voice answers · [197](https://linear.app/borderless-coding/issue/LABS01-197) repeat / skip / end early · [198](https://linear.app/borderless-coding/issue/LABS01-198) mobile composer + resume |
| **PWA** | Vini | T1 [174](https://linear.app/borderless-coding/issue/LABS01-174) spike · T2 [184](https://linear.app/borderless-coding/issue/LABS01-184) manifest · T4 [186](https://linear.app/borderless-coding/issue/LABS01-186) service worker · T5 [187](https://linear.app/borderless-coding/issue/LABS01-187) install prompt · T6 [188](https://linear.app/borderless-coding/issue/LABS01-188) offline banner · T7 [189](https://linear.app/borderless-coding/issue/LABS01-189) offline history · T10 [193](https://linear.app/borderless-coding/issue/LABS01-193) release check |

Order: **C0 first** (security). A1 before PWA T4. Interview UI and PWA run in parallel; both touch the chat composer, so 198 lands after T6.

## Rules

- One Linear issue = one branch (`LABS01-XX-slug`) = one PR, squash to `main`.
- Done = merged + `STATE.md` updated. No "commits deferred".
- New env var → `.env.example` + a Deploy line in the PR.
