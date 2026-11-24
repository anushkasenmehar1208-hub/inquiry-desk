# Four-stage build plan

The assessment is intentionally narrow: complete one flow well. Do not add charts, notifications, roles, payments, or elaborate design.

## Stage 1 — Foundation and sign-in (Nov 22)
- [x] Read all five pages of the assessment and related hiring email
- [x] Create project structure (Next.js, Express, PostgreSQL)
- [x] Define persistent schema
- [x] Add seeded demo accounts and backend-enforced login/session
- [x] Build restrained, responsive sign-in UI
- [x] Run a clean install, native PostgreSQL setup, migration, and seed from a fresh clone
- [x] Pass backend unit and PostgreSQL integration tests for login and sessions
- [x] Build the frontend for production and pass the automated failed-login test
- [x] Verify keyboard sign-in, session refresh, and sign-out at desktop and mobile widths

**Acceptance:** A signed-out request gets a 401. Alex and Sam can sign in, refresh, and sign out. The previous session gets a 401 after logout.

## Stage 2 — Capture and overview (Nov 23)
- [x] POST `/api/inquiries` validates all four required fields
- [x] GET `/api/inquiries` lists, searches, and filters the signed-in employee's inquiries
- [x] Create inquiry form with error, success, and loading feedback
- [x] List inquiry statuses and combine text search with a status filter
- [x] Decide and document simple duplicate-submission policy
- [x] Verify browser creation, reload, filtering, and owner isolation against PostgreSQL

**Acceptance:** A staff member creates an inquiry, reloads, and finds it in PostgreSQL.

## Stage 3 — Lifecycle and trust (Nov 24)
- [x] GET `/api/inquiries/:id` enforces ownership
- [x] PATCH `/api/inquiries/:id/status` validates allowed transitions
- [x] Distinguish 400 / 401 / 404 / 409 appropriately
- [x] Handle stale tabs with a version check and a refresh prompt
- [x] Add tests for access denial using a second seeded user

**Acceptance:** The backend denies direct links and updates for other users; status updates follow documented transitions and reject stale versions. Verified against PostgreSQL and the real two-tab browser test on Nov 24: 3 unit tests, 27 integration tests, 9 isolated browser tests, one live lifecycle test, and a successful production build (Stage 3 baseline).

## Stage 4 — Test, document, and deliver (Nov 25)
- [x] Meaningful backend tests for ownership/validation/status
- [x] Frontend test of a user action or error state
- [x] Review empty, loading, and failed-save states; add final audit regressions
- [ ] Verify a fresh checkout, setup and final regression suite
- [x] Revise README and approximately one-page DECISIONS.md (applicant to confirm AI example and understand choices)
- [ ] Record 3–5-minute walkthrough showing workflow and failure case
- [ ] Merge verified final changes into main; ensure reviewer access and submit repository link and recording

**Acceptance:** Everything in the PDF is met, including explanation of AI usage and a feature you can change live in interview.

## Timing

Acceptance was sent Nov 19, 2026. The 7-calendar-day period therefore appears to run to Nov 26. Exact cutoff and submission destination have been requested but are unconfirmed. Aim to submit by Nov 25; if no instructions arrive, reply to the original assessment email with the repository link and recording rather than miss the deadline.
