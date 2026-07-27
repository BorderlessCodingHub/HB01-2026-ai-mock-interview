# Borderless Auth via better-auth Specification

## Problem Statement

Local email/password JWT auth duplicates the Borderless Coding identity platform. Users already have Borderless accounts; this app must authenticate against `POST https://api.borderlesscoding.com/api/auth/signin` and authorize API calls with the Borderless `accessToken`, while keeping local domain ownership via mapped Int user IDs.

## Goals

- [ ] Users sign in with Borderless email/password via better-auth on Next.js
- [ ] All Express protected routes accept only a valid Borderless Bearer `accessToken`
- [ ] Local `User` rows are upserted by `externalId` so interview/resume FKs stay Int
- [ ] Local signup/login/refresh/password-reset are removed

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Borderless signup / password-reset | No API contract provided |
| Borderless refresh token | Not in signin response |
| Migrating `User.id` to UUID/string | Keep Int FKs (AD-009 mapping) |
| OAuth / social login | Not requested |

---

## User Stories

### P1: Sign in with Borderless credentials ⭐ MVP

**User Story**: As a candidate, I want to sign in with my Borderless email and password so I can use the mock interview app with my existing account.

**Why P1**: Without login, no authenticated product surface works.

**Acceptance Criteria**:

1. WHEN the user submits valid email/password on `/login` THEN the system SHALL call Borderless `POST /api/auth/signin` via better-auth and establish a session
2. WHEN Borderless returns 200 THEN the system SHALL expose `data.token.accessToken` for subsequent API calls
3. WHEN Borderless returns 400/401/403/429/500 THEN the system SHALL show a clear error and SHALL NOT create a session
4. WHEN the user is unauthenticated and visits a protected app route THEN the system SHALL redirect to `/login`

**Independent Test**: Sign in with valid Borderless credentials → land on dashboard with session; invalid credentials → error, stay on login.

---

### P1: Authorize Express APIs with Borderless Bearer

**User Story**: As a candidate, I want my API requests authenticated with my Borderless token so my data stays scoped to me.

**Why P1**: Domain APIs currently require Bearer auth.

**Acceptance Criteria**:

1. WHEN a request includes a valid Borderless Bearer JWT THEN Express SHALL set `req.userId` to the local Int user id
2. WHEN the Bearer is missing, invalid, or expired THEN Express SHALL return 401
3. WHEN a valid token is presented for a first-time user THEN the system SHALL upsert a local `User` by `externalId` before continuing
4. WHEN the frontend receives 401 from Express THEN it SHALL clear the session and redirect to `/login` (no local refresh)

**Independent Test**: Call a protected endpoint with a signed test JWT → 200 and local user row; expired JWT → 401.

---

### P1: Remove local auth surface

**User Story**: As a developer, I want local auth endpoints and signup UI gone so there is a single identity source.

**Why P1**: Avoid dual auth and credential drift.

**Acceptance Criteria**:

1. WHEN the app is running THEN `POST /api/auth/signup|login|refresh|request-password-reset|reset-password` SHALL not exist (404 or unmounted)
2. WHEN the user opens `/login` THEN only sign-in SHALL be available (no signup toggle)
3. WHEN the user logs out THEN the better-auth session SHALL be cleared and API calls SHALL stop sending Bearer

**Independent Test**: Hit former auth routes → not available; login page has no signup form; logout clears session.

---

### P2: Sync profile fields on upsert

**User Story**: As a candidate, I want my name/email from Borderless reflected locally so UI greetings stay accurate.

**Why P2**: Works with placeholder name, but better UX with sync.

**Acceptance Criteria**:

1. WHEN upserting from JWT claims THEN the system SHALL update local `name` and `email` when present in claims
2. WHEN `interviewLocale` already exists locally THEN upsert SHALL NOT overwrite it

**Independent Test**: Authenticate twice with updated `name` claim → local row name updates; locale preserved.

---

## Edge Cases

- WHEN Borderless returns rate limit (429) THEN system SHALL surface a retry-friendly message
- WHEN JWT lacks required identity claims (`sub`/`id` and `email`) THEN Express SHALL return 401
- WHEN two tokens map to the same email but different `externalId` THEN system SHALL fail safely (unique email constraint) without corrupting other users
- WHEN `accessToken` is opaque (not JWT) THEN Next.js SHALL register the token in Express Redis at login (`POST /internal/borderless-sessions`); Express SHALL resolve opaque Bearers via Redis lookup (no introspect/`me` required)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| AUTH-01 | P1: Sign in | Execute | Implemented |
| AUTH-02 | P1: Sign in / session exposes token | Execute | Implemented |
| AUTH-03 | P1: Express Bearer | Execute | Implemented |
| AUTH-04 | P1: Upsert by externalId | Execute | Implemented |
| AUTH-05 | P1: Error mapping | Execute | Implemented |
| AUTH-06 | P1: Logout | Execute | Implemented |
| AUTH-07 | P1: Remove local auth | Execute | Implemented |
| AUTH-08 | P1: Expired → login | Execute | Implemented |
| AUTH-09 | P2: Profile sync | Execute | Implemented |

**Coverage:** 9 total, 9 mapped to tasks T1–T10, 0 unmapped

---

## Success Criteria

- [ ] User can complete Borderless login and reach dashboard
- [ ] Protected Express routes work with Borderless Bearer only
- [ ] Local auth routes and signup UI are gone
- [ ] Existing interview/resume ownership still uses Int `userId`
