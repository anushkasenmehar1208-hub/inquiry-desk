import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { after, before } from "node:test";
import pg from "pg";
import { hashPassword } from "../../src/lib/password.js";

export function setupIntegrationApp() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("Set TEST_DATABASE_URL to a PostgreSQL database for integration tests.");
  }

  const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
  const admin = new pg.Client({ connectionString: databaseUrl.href, connectionTimeoutMillis: 5000 });
  const schema = `api_test_${randomBytes(8).toString("hex")}`;
  const webOrigin = "http://localhost:3000";
  const password = randomBytes(24).toString("hex");
  const alex = { id: randomUUID(), name: "Alex Morgan", email: "alex@example.test" };
  const sam = { id: randomUUID(), name: "Sam Lee", email: "sam@example.test" };

  let schemaCreated = false;
  let pool;
  let server;
  let baseUrl;

  before(async () => {
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    schemaCreated = true;

    databaseUrl.searchParams.set("options", `-c search_path=${schema}`);
    process.env.DATABASE_URL = databaseUrl.href;
    process.env.WEB_ORIGIN = webOrigin;
    process.env.NODE_ENV = "production";
    ({ pool } = await import("../../src/db.js"));
    const { app } = await import("../../src/app.js");

    const { rows } = await pool.query("SELECT current_schema() AS name");
    assert.equal(rows[0].name, schema);
    await pool.query(await readFile(new URL("../../sql/001_init.sql", import.meta.url), "utf8"));
    const passwordHash = await hashPassword(password);
    for (const { id, name, email } of [alex, sam]) {
      await pool.query(
        "INSERT INTO staff_users (id, full_name, email, password_hash) VALUES ($1, $2, $3, $4)",
        [id, name, email, passwordHash],
      );
    }

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    try {
      if (server?.listening) {
        const closed = once(server, "close");
        server.close();
        await closed;
      }
      await pool?.end();
      if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    } finally {
      await admin.end();
    }
  });

  function request(path, options = {}) {
    return fetch(baseUrl + path, { signal: AbortSignal.timeout(5000), ...options });
  }

  function loginRequest(credentials, origin = webOrigin) {
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify(credentials),
    });
  }

  async function signIn(email = alex.email) {
    const response = await loginRequest({ email, password });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), webOrigin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    const setCookie = response.headers.get("set-cookie");
    assert.ok(setCookie);
    const cookie = setCookie.split(";")[0];
    const token = cookie.slice("inquiry_session=".length);
    assert.match(cookie, /^inquiry_session=[a-f0-9]{64}$/);
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return { response, setCookie, cookie, token, tokenHash };
  }

  return {
    alex, sam, password, webOrigin, request, loginRequest, signIn,
    get pool() { return pool; },
  };
}
