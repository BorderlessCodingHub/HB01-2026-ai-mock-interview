# Auto-start Interview Ready Message — Specification

## Problem Statement

After **Start New Practice**, the chat still requires a second click on a hardcoded English "Hi, I'm ready for the interview!" CTA before the AI begins. That extra step adds friction, and Portuguese locale sessions still send English copy.

## Goals

- [ ] Starting a new practice interview auto-sends the ready message without a second click
- [ ] Ready message (and fallback CTA label) match `interviewLocale` (`en` | `pt`)

## Out of Scope

| Item | Reason |
| ---- | ------ |
| Study / review-session auto-start | Different product surface; out of this request |
| Full app UI i18n | Separate feature; only interview ready/welcome copy |
| Backend create/stream API changes | Existing `{ content, interviewLocale }` is enough |

---

## User Stories

### P1: Auto-send ready message on empty session load ⭐ MVP

**User Story**: As a candidate, I want the interview to start as soon as I click Start New Practice so that I do not need a second confirmation click.

**Why P1**: Core friction removal for the practice flow.

**Acceptance Criteria**:

1. WHEN Start New Practice succeeds and the chat loads with 0 messages THEN the system SHALL send the ready message without a second click
2. WHEN messages are still loading THEN the system SHALL NOT auto-send
3. WHEN the session already has messages THEN the system SHALL NOT auto-send
4. WHEN auto-send already ran for this session in the current mount THEN the system SHALL NOT send twice (Strict Mode / remount guard)
5. WHEN auto-send fails THEN the welcome CTA SHALL remain available so the user can start manually

**Independent Test**: Start New Practice → first human bubble appears automatically → AI streams first question. Open a session that already has messages → no extra ready message.

---

### P1: Locale-aware ready copy ⭐ MVP

**User Story**: As a candidate, I want the opening ready message in my selected interview language so that the transcript matches EN or PT from the first turn.

**Why P1**: Locale preference already drives the LLM; the human kickoff must match.

**Acceptance Criteria**:

1. WHEN `interviewLocale` is `en` THEN the ready message content SHALL be `Hi, I'm ready for the interview!`
2. WHEN `interviewLocale` is `pt` THEN the ready message content SHALL be `Olá, estou pronto para a entrevista!`
3. WHEN the fallback welcome CTA is shown THEN its button label SHALL use the same localized ready string

**Independent Test**: Selector EN → Start New Practice → human message is EN. Switch to PT → new practice → human message is PT.

---

## Edge Cases

- WHEN the messages query errors THEN the system SHALL NOT auto-send and SHALL show the existing error UI
- WHEN the session is already finished or at turn limit THEN the system SHALL NOT auto-send
- WHEN React Strict Mode double-invokes effects THEN at most one ready stream SHALL be initiated for that session

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ASR-01 | P1: Auto-send on empty load | Execute | Verified |
| ASR-02 | P1: No send while loading / non-empty | Execute | Verified |
| ASR-03 | P1: Single-send guard | Execute | Verified |
| ASR-04 | P1: Fallback CTA on failure | Execute | Verified |
| ASR-05 | P1: EN ready copy | Execute | Verified |
| ASR-06 | P1: PT ready copy | Execute | Verified |

**Coverage:** 6 total, implemented in InterviewChat + ready-message helper (tasks skipped — medium scope)

---

## Success Criteria

- [ ] Start New Practice with EN → auto human message in English → AI replies
- [ ] Start New Practice with PT → auto human message in Portuguese → AI replies
- [ ] Existing session with messages → no duplicate ready send
- [ ] Failed auto-start → welcome button still starts the interview once
