# Inquiry Desk

A small customer inquiry management system, built for the Coffee Ninja full-stack internship assessment.

**Stage 1 complete.** Seeded staff accounts can sign in to the Next.js workspace, refresh, and sign out. Express checks sessions in PostgreSQL.

## Stack
- Next.js / React frontend (`web/`)
- Express / Node.js backend (`api/`)
- PostgreSQL database (schema in `api/sql/`)
- Server-side authentication with scrypt password hashes and opaque session cookies

## Local setup

You need Node.js 22+, npm, and PostgreSQL. The Docker Compose configuration uses PostgreSQL 17.

From the checkout root, run `cd inquiry-desk`. Run the remaining commands from that folder, where `package.json` and `compose.yaml` live.

1. With Docker, run `docker compose up -d db` and wait for the database to be healthy. For a native installation, start PostgreSQL and create the role and database once as a local PostgreSQL admin.
   ```sh
   createuser --pwprompt inquiry
   createdb --owner=inquiry inquiry_desk
   ```
2. Create local configuration files from the examples.
   ```sh
   cp api/.env.example api/.env
   cp web/.env.local.example web/.env.local
   ```
   For native PostgreSQL, match `DATABASE_URL` in `api/.env` to the role password and server port.
3. Install dependencies, create the tables, and seed the demo accounts.
   ```sh
   npm ci
   npm run db:migrate
   npm run db:seed
   ```
4. Run `npm run dev:api` and `npm run dev:web` in separate terminals. Open [Inquiry Desk](http://localhost:3000) and check that [API health](http://localhost:4000/api/health) returns `{"status":"ok"}`.

Local-only demo users:

| Email | Password |
| --- | --- |
| alex@example.test | Welcome123! |
| sam@example.test | Welcome123! |

Do not deploy with the demo password. The seeding script refuses to run when `NODE_ENV=production`.

## Tests

- Run `npm test` for the backend unit tests.
- Create a separate test database with `createdb --owner=inquiry inquiry_desk_test` as a native PostgreSQL admin, or with `docker compose exec db createdb -U inquiry inquiry_desk_test`. Set `TEST_DATABASE_URL` to the test database connection string and run `npm run test:integration`. The role needs permission to create schemas. The suite creates and removes its own schema.
- For the frontend test, run `npx playwright install --only-shell chromium` once, then `npm run build -w web` and `npm run test:frontend`. Playwright starts the built frontend on port 3100 and stubs the API to verify recovery from an incorrect password.

For an end-to-end check, try an incorrect password, sign in with a demo account, refresh, sign out, and refresh again. The signed-out page should stay signed out, and `GET /api/auth/me` should return 401. Run through the form with Tab and Enter and check it at a narrow viewport.

If npm or Node stalls reading files on a cloud-synced macOS checkout, run `npm ci` to recreate local dependencies. If a build times out reading `web/.next`, remove that generated directory and rebuild. A checkout outside the synced folder avoids repeat offloading.

## Roadmap

See [ROADMAP.md](inquiry-desk/ROADMAP.md) for the Stage 1 checklist and the remaining assessment stages.

## Security scope

This is a local assessment project, not a production-ready authentication service. It uses parameterized SQL, hashed passwords, random session tokens stored hashed in the database, and HttpOnly cookies. Before public deployment it would need rate limiting, production TLS/origin review, and operational monitoring. No registration, reset-password, or production hosting is required by the assessment.
