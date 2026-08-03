# Review Item Angles — Tasks

**Spec**: `.specs/features/review-item-angles/spec.md`  
**Design**: `.specs/features/review-item-angles/design.md`

## Execution Plan

```
T1 Schema+migration
  └─ T2 Records/repo/merge [pair-aware]
       ├─ T3 Generator schema+prompt [P with T4 after T2]
       ├─ T4 Practice covered angles [P]
       └─ T5 Study prompts+session snapshot [P]
            └─ T6 API+FE display
                 └─ T7 Verify+docs
```

---

### T1: Prisma `angle` + uniqueness migration

**What**: Add `angle` to `ReviewItem` and `ReviewSessionItem`; migrate backfill `general`; unique `(userId, topic, angle)`.

**Where**: `backend/prisma/schema/ai-mock-interview.prisma`, new migration SQL

**Depends on**: —

**Done when**:
- [ ] Columns exist NOT NULL
- [ ] Old unique dropped; new unique applied
- [ ] Existing rows backfilled `general`
- [ ] `bunx prisma generate` succeeds

**Tests**: none (schema); gate: generate

**Gate**: `cd backend && bunx prisma generate`

---

### T2: Repository + merge pair-aware

**What**: Thread `angle` through records, upsert, exact/similar find, `insertNewTopicsOnly` / `upsertItems`.

**Where**: `review-item-record.ts`, `review-repository.ts`, `review-merge-service.ts` + unit/integration tests

**Depends on**: T1

**Done when**:
- [ ] Upsert key is `userId_topic_angle`
- [ ] Exact + similar find by pair
- [ ] Insert skips matching pair; inserts different angle same topic
- [ ] Unit tests green; integration updated

**Tests**: unit (merge) + integration (repo)

**Gate**: `bun run test -- review-merge-service` (+ integration if Docker)

---

### T3: Generator schema + prompt `[P]`

**What**: Require `angle` in Zod output; update generator prompt + existingItems shape + adapter + tests.

**Where**: `interview-schemas.ts`, `review-items-generator-prompt.ts`, adapter, related tests

**Depends on**: T2 (adapter maps `angle` from records)

**Done when**:
- [ ] Schema rejects missing angle
- [ ] Prompt instructs specific angles + reuse exact strings
- [ ] Existing items include angle
- [ ] Unit tests green

**Tests**: unit

**Gate**: `bun run test -- interview-schemas review-items-generator`

---

### T4: Practice covered angles `[P]`

**What**: Pass covered `{topic,angle}[]` into interview graph + interviewer system prompt; load in stream service.

**Where**: `interview-state.ts`, `interview-graph.ts`, `build-interview-graph.ts`, `interviewer-node.ts`, `interviewer-system-prompt.ts`, `stream-service.ts` (+ factory DI for ReviewRepository), tests

**Depends on**: T2

**Done when**:
- [ ] Prompt includes covered-angles block when non-empty
- [ ] Variety instruction present
- [ ] Stream loads listByUserId → coveredAngles
- [ ] Unit tests green

**Tests**: unit (prompt, node, stream mock)

**Gate**: `bun run test -- interviewer-system-prompt stream-service interviewer-node`

---

### T5: Study prompts + session snapshot `[P]`

**What**: Snapshot `angle` on session items; include in question/eval prompts and stream inputs.

**Where**: review-session repository/service/types/prompts/protocols/stream-service + tests

**Depends on**: T1 (column); soft-depends T2 for record.angle

**Done when**:
- [ ] Create snapshots angle
- [ ] Question + eval prompts include Angle section
- [ ] Stream passes angle to generators
- [ ] Unit tests green

**Tests**: unit (+ integration snapshot if touching repo create)

**Gate**: `bun run test -- review-session`

---

### T6: API + FE display

**What**: Expose `angle` on review-items and review-session responses; FE types; show `topic — angle` on study cards, report, chat dividers, dashboard grid, history labels.

**Where**: BE response mappers/schemas; FE `types/*`, study + dashboard components

**Depends on**: T2, T5

**Done when**:
- [ ] API schemas include angle
- [ ] FE type has angle
- [ ] UI shows `topic — angle`
- [ ] Related unit tests / check-types green

**Tests**: BE schema unit; FE `check-types`

**Gate**: `bun run check-types` (backend + frontend)

---

### T7: Verify + project docs

**What**: Run unit suite / types; update ROADMAP + STATE; mark ANGLE-* verified in spec traceability.

**Depends on**: T1–T6

**Done when**:
- [ ] Backend unit tests pass for touched areas
- [ ] ROADMAP lists feature
- [ ] STATE records decision + current work

**Gate**: `bun run test` (backend), `bun run check-types`

---

## Traceability

| Requirement | Tasks |
|-------------|-------|
| ANGLE-01–03 | T1, T2 |
| ANGLE-04 | T6 |
| ANGLE-05 | T5 |
| ANGLE-06–09 | T2, T3 |
| ANGLE-10–11 | T4 |
| ANGLE-12–13 | T5 |
| ANGLE-14 | T6 |
