# Inquiry Desk

A small customer inquiry management application for the Coffee Ninja full-stack development assessment. Staff can sign in, record inquiries, search/filter their own records, open details and update statuses.

## Stack

Next.js / React frontend (`inquiry-desk/web`), Express / Node.js API (`inquiry-desk/api`), and PostgreSQL. The schema lives in `api/sql/001_init.sql`.

## Local setup

Requirements: Node.js 22+, npm, and PostgreSQL (Docker Compose uses PostgreSQL 17).

From the repository root, run `cd inquiry-desk`. Run the commands below from that application directory.

1. Start the database: `docker compose up -d db`. Wait for it to become healthy. Alternatively, start native PostgreSQL and create the role and database as a PostgreSQL admin:

   ```sh
   createuser --pwprompt inquiry
   createdb --owner=inquiry inquiry_desk
   ```

2. Create local configuration and install dependencies:

   ```sh
   cp api/.env.example api/.env
   cp web/.env.local.example web/.env.local
   npm ci
   npm run db:migrate
   npm run db:seed
   ```

   For native PostgreSQL, adjust `DATABASE_URL` in `api/.env` to match the local role, password and port. Migration and seed can safely be rerun.

3. Start the API and frontend in separate terminals:

   ```sh
   npm run dev:api
   ```

   ```sh
   npm run dev:web
   ```

   Open [http://localhost:3000](http://localhost:3000). The [API health endpoint](http://localhost:4000/api/health) checks database connectivity. Use localhost consistently for the cookie and allowed browser origin.

### Demo accounts

| Email | Local demo password |
| --- | --- |
| alex@example.test | Welcome123! |
| sam@example.test | Welcome123! |

These accounts are for local demonstration only. The seeding script refuses to run in production. Never commit real credentials or customer data.

## Workflow

Sign in as Alex, create an inquiry and find it using search and the status filter. Open its details to change its status:

**New → In Progress → Resolved → In Progress** (reopen).

Only the creator can view/update a record. Missing and inaccessible records return 404; invalid input, IDs or transitions return 400; missing sessions return 401. Each successful status update increments a version number. An outdated update receives 409 and the UI prompts the user to refresh. The app does not perform real-time synchronization.

## Tests

From the application directory:

```sh
npm test
```

Create a separate database, using either native PostgreSQL admin access or Docker:

```sh
createdb --owner=inquiry inquiry_desk_test
# Or: docker compose exec db createdb -U inquiry inquiry_desk_test
```

Run the PostgreSQL integration suite using the local connection configuration:

```sh
TEST_DATABASE_URL="$(node --env-file=api/.env -e 'const u = new URL(process.env.DATABASE_URL); u.pathname = "/inquiry_desk_test"; process.stdout.write(u.href)')" npm run test:integration
```

The test role needs permission to create schemas. Tests create and remove their own schemas and exercise real PostgreSQL.

Stop any running frontend server before the production build and isolated browser tests:

```sh
npx playwright install --only-shell chromium
npm run build -w web
npm run test:frontend
```

The default browser suite stubs the API; live tests are intentionally skipped. To run both real-browser tests, start the development API and frontend as described above and run:

```sh
RUN_LIVE_E2E=1 E2E_ALEX_PASSWORD='Welcome123!' E2E_SAM_PASSWORD='Welcome123!' npm run test:frontend -- inquiries.live.spec.js lifecycle.live.spec.js
```

Use a disposable local development database: the two tests create records and leave them there. These checks cover creation, persistence after refresh, filtering, the status lifecycle, a stale tab and access denial for Sam.

### Testing scope and limitations

The PostgreSQL suite tests authentication, validation, ownership, status transitions and competing writes. Isolated browser tests cover interactions, loading, empty and error states, and narrow-screen layout; the two optional live tests connect to the real API. Chromium is the automated browser target. Production deployment, cross-browser compatibility, load testing and a formal security audit are outside this assessment. Browser tabs sharing a session cookie share the login; use separate browser profiles for different staff accounts.

If macOS cloud-synced files time out during reads, use a checkout outside the synced directory and run `npm ci` again.

## Engineering choices

See [DECISIONS.md](inquiry-desk/DECISIONS.md) for ownership, duplicate submissions, state transitions, trade-offs and AI assistance. See [ROADMAP.md](inquiry-desk/ROADMAP.md) for the verification and delivery checklist.
