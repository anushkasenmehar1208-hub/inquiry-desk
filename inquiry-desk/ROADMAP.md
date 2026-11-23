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
- [ ] Create inquiry form with error, success, and loading feedback
- [ ] List statuses and search or filter inquiries
- [x] Decide and document simple duplicate-submission policy

**Acceptance:** A staff member creates an inquiry, reloads, and finds it in PostgreSQL.

## Stage 3 — Lifecycle and trust (Nov 24)
- [ ] GET `/api/inquiries/:id` enforces ownership
- [ ] PATCH `/api/inquiries/:id/status` validates allowed transitions
- [ ] Distinguish 400 / 401 / 404 / 409 appropriately
- [ ] Handle stale tabs with a version check and a refresh prompt
- [ ] Demonstrate access denial using a second seeded user

**Acceptance:** Users cannot fetch other users' inquiries through direct links or the API; status transitions behave predictably.

## Stage 4 — Test, document, and deliver (Nov 25)
- [ ] Meaningful backend tests for ownership/validation/status
- [ ] Frontend test of a user action or error state
- [ ] Review empty, loading, and failed-save states
- [ ] Verify clean setup from a fresh clone
- [ ] Finish concise README and approximately one-page DECISIONS.md
- [ ] Record 3–5-minute walkthrough showing workflow and failure case
- [ ] Push to GitHub and submit through recruiter-confirmed method

**Acceptance:** Everything in the PDF is met, including explanation of AI usage and a feature you can change live in interview.

## Timing

The acceptance email was sent Nov 19, 2026, around 8:15 PM Sri Lanka time. The 7-calendar-day period therefore appears to run to Nov 26. Exact cutoff and submission destination have been requested but are unconfirmed. Plan to finish by Nov 25 rather than depend on a last-minute interpretation.
