# Engineering decisions

**Project:** Inquiry Desk.

## Scope and assumptions
A small service business needs employees to record and manage customer inquiries. The core workflow is sign in, capture, find, open, and update status. Staff accounts are seeded; there is no customer login, messaging, analytics, or deployment requirement.

## Decision 1: Owner-only access
The creating staff member owns an inquiry. The API derives the owner from the signed-in session, filters list and detail queries by that owner, and refuses updates by other staff. An inaccessible ID returns the same **404** as a missing record, so a direct link cannot reveal another employee's data.

**Trade-off:** Staff cannot take over one another's work. Adding handovers would complicate permissions and is outside this assessment.

## Decision 2: Server-managed sessions and small PostgreSQL model
Express authenticates every protected API request with a random, HttpOnly session cookie. Only the session token's hash is kept in PostgreSQL; passwords use salted scrypt hashes. PostgreSQL stores users, sessions, and inquiries. Parameterized SQL is used for all user input. Express and the PostgreSQL driver keep the API small; React local state and plain CSS avoid extra application dependencies. Node's test runner and Playwright cover the API and browser interactions.

Each valid submission is a separate record, even if its text matches another inquiry. Required fields are trimmed, validated in both UI and API, and rejected if missing or too long. Search is a simple case-insensitive literal substring filter.

## Decision 3: Explicit transitions and stale-update safety
Allowed moves are **New → In Progress → Resolved → In Progress**. A resolved inquiry may be reopened to continue work. Skipping a state or moving backward to New is invalid. The server enforces transitions, not just the buttons.

Opening a record returns its integer `version`. A status update sends the version last seen by the user. PostgreSQL updates only if it still matches, then increments it. Another tab's earlier version receives **409 Conflict**; the UI explains the problem and asks the user to refresh. This avoids silently overwriting newer work without real-time infrastructure.

## AI and outside resources
AI tools helped shape the app architecture, code, tests, and review process. **Example accepted:** the suggestion to use an integer version check and a refresh prompt for two-tab conflicts rather than introduce live synchronization. It is a small approach that is easy to explain and test. AI also helped review edge cases and write regression tests.

## Next improvement
For production use, add sign-in rate limiting, better operational monitoring, and a documented staff handover policy. None is necessary for this seven-day assessment.
