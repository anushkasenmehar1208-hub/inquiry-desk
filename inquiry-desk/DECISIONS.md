# Engineering decisions (working draft)

**Project:** Inquiry Desk. **Status:** Stage 2, inquiry creation and listing API.

## Scope
The task is to manage inquiries, not build a CRM. Keep capture, retrieval, and status changes central. No dashboards, analytics, notifications, or customer messaging.

## Decision 1: Owner-only access
Each inquiry belongs to the staff member who created it. The API sets the owner from the authenticated session and filters lists by that same staff ID. The list accepts only `q` and `status` as query parameters.

**Trade-off:** Staff cannot cover each other's inquiries during absence. A handover feature may be useful later, but is outside the assessment scope.

## Decision 2: Real sessions, no frontend-only authentication
Passwords use Node's built-in scrypt with a random salt. On sign-in, the API issues a random opaque session token in an HttpOnly cookie; PostgreSQL stores only its SHA-256 hash. Protected routes must look up the session on the server. Login remains valid on refresh and logout removes the server-side session.

## Decision 3: A small relational model
PostgreSQL holds staff, sessions, and inquiries. Each inquiry starts as New. A `status` check limits values to New, In Progress, and Resolved. An integer `version` field is reserved to handle stale updates.

## Decision 4: Separate submissions and literal search
Each valid POST creates a separate inquiry, even when its content matches an existing one. A customer may contact staff twice about the same issue.

The optional `q` filter matches a case-insensitive substring in customer name, customer contact, subject, or description. Punctuation is literal, and a blank `q` leaves text search off. The optional `status` filter matches one of the three stored statuses exactly.

## AI and outside resources
An AI assistant helped prepare the initial architecture, starter code, and assessment checklist. This is a draft generated with AI assistance; it must be reviewed, understood, and revised by the applicant before submission. Record one specific suggestion accepted, changed, or rejected, and why. Be prepared to explain or modify any function during the interview.

## Next improvement
After Stage 4, review production concerns such as sign-in rate limiting and operational controls. These are intentionally not part of the assessment's minimum scope.
