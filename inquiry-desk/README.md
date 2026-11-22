# Inquiry Desk

A small customer inquiry management system, built for the Coffee Ninja full-stack internship assessment.

**Current status: Stage 1 of 4.** The project has a PostgreSQL schema, seeded staff accounts, an Express authentication API, and a Next.js sign-in page. Inquiry management endpoints and screens have not been built yet. This is not a complete assessment submission.

## Stack
- Next.js / React frontend (`web/`)
- Express / Node.js backend (`api/`)
- PostgreSQL database (schema in `api/sql/`)
- Server-side authentication with scrypt password hashes and opaque session cookies

## Local setup

You need Node.js 22+, npm, and PostgreSQL. The Docker Compose configuration uses PostgreSQL 17.

Run the commands below from the folder containing this README and `package.json`.

1. Start PostgreSQL with `docker compose up -d db` if you use Docker. For a local installation, create a login role and a database owned by that role, then set `DATABASE_URL` in `api/.env` after copying the configuration files.
2. Copy configuration files:
   ```sh
   cp api/.env.example api/.env
   cp web/.env.local.example web/.env.local
   ```
3. Install dependencies with `npm ci`.
4. Create tables: `npm run db:migrate`.
5. Add local test accounts: `npm run db:seed`.
6. Start the API in terminal 1: `npm run dev:api`.
7. Start the frontend in terminal 2: `npm run dev:web`.
8. Open http://localhost:3000.

Local-only demo users:

| Email | Password |
| --- | --- |
| alex@example.test | Welcome123! |
| sam@example.test | Welcome123! |

Do not deploy with the demo password. The seeding script refuses to run when `NODE_ENV=production`.

## Stage 1 verification

- API health: http://localhost:4000/api/health should respond with `{"status":"ok"}` after migration.
- Wrong password returns 401. Signed-out `/api/auth/me` also returns 401.
- Sign in with either demo account and verify you see the staff workspace.
- Refresh: the session should persist. Sign out: the session should end.
- Run `npm test` for the password, token, and cookie unit tests.
- Set `TEST_DATABASE_URL` to a local PostgreSQL test database and run `npm run test:integration`. The database role needs permission to create schemas. Each run creates and cleans up its own schema.

## Roadmap

See [ROADMAP.md](ROADMAP.md). The final submission will include working inquiry creation, list/search, status updates, access rules, meaningful backend/frontend tests, README, `DECISIONS.md`, and a 3–5-minute walkthrough.

## Security scope

This is a local assessment project, not a production-ready authentication service. It uses parameterized SQL, hashed passwords, random session tokens stored hashed in the database, and HttpOnly cookies. Before public deployment it would need rate limiting, production TLS/origin review, and operational monitoring. No registration, reset-password, or production hosting is required by the assessment.
