import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { setupIntegrationApp } from "./support/integration-app.js";

const fixture = setupIntegrationApp();
const { alex, sam, password, webOrigin, loginRequest, signIn } = fixture;

beforeEach(async () => {
  await fixture.pool.query("DELETE FROM sessions");
});

function request(path, options) {
  return fixture.request(`/auth${path}`, options);
}

test("a request without a session gets 401", async () => {
  const response = await request("/me");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Please sign in to continue." });
});

test("login rejects missing and invalid credentials without issuing sessions", async () => {
  for (const credentials of [undefined, {}, { email: alex.email }, { password }, { email: " ", password }, { email: "bad\u0000@example.test", password }]) {
    const response = await loginRequest(credentials);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { error: "Enter your email and password." });
  }
  for (const credentials of [
    { email: alex.email, password: "wrong password" },
    { email: "unknown@example.test", password },
  ]) {
    const response = await loginRequest(credentials);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.deepEqual(await response.json(), { error: "Incorrect email or password." });
  }
  const { rows } = await fixture.pool.query("SELECT count(*)::int AS count FROM sessions");
  assert.equal(rows[0].count, 0);
});

test("login stores only the token digest and /me uses the session's identity", async () => {
  const session = await signIn("  ALEX@EXAMPLE.TEST  ");
  assert.deepEqual(await session.response.json(), { user: alex });
  assert.match(session.setCookie, /; HttpOnly(?:;|$)/i);
  assert.match(session.setCookie, /; Secure(?:;|$)/i);
  assert.match(session.setCookie, /; SameSite=Lax(?:;|$)/i);
  assert.match(session.setCookie, /; Path=\/(?:;|$)/i);

  const { rows } = await fixture.pool.query("SELECT * FROM sessions");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, alex.id);
  assert.equal(rows[0].token_hash, session.tokenHash);
  assert.ok(!JSON.stringify(rows[0]).includes(session.token), "the session row contains the raw token");
  assert.ok(rows[0].expires_at > rows[0].created_at);

  const response = await request(`/me?userId=${sam.id}`, { headers: { Cookie: session.cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: alex });
});

test("modified and malformed session cookies get 401", async () => {
  const { cookie } = await signIn();
  const modifiedCookie = cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0");
  for (const invalidCookie of [modifiedCookie, "inquiry_session=%ZZ"]) {
    const response = await request("/me", { headers: { Cookie: invalidCookie } });
    assert.equal(response.status, 401);
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }
  assert.equal((await request("/me", { headers: { Cookie: cookie } })).status, 200);
});

test("an expired session gets 401 even while its row exists", async () => {
  const { cookie, tokenHash } = await signIn();
  assert.equal((await request("/me", { headers: { Cookie: cookie } })).status, 200);
  const { rowCount } = await fixture.pool.query(
    "UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
    [tokenHash],
  );
  assert.equal(rowCount, 1);
  const response = await request("/me", { headers: { Cookie: cookie } });
  assert.equal(response.status, 401);
  assert.deepEqual(Object.keys(await response.json()), ["error"]);
});

test("logout clears the browser cookie and revokes only the presented session", async () => {
  const alexSession = await signIn();
  const samSession = await signIn(sam.email);
  const response = await request("/logout", {
    method: "POST",
    headers: { Cookie: alexSession.cookie, Origin: webOrigin },
  });
  assert.equal(response.status, 204);
  const clearedCookie = response.headers.get("set-cookie");
  assert.match(clearedCookie, /^inquiry_session=;/);
  assert.ok(Date.parse(/; Expires=([^;]+)/i.exec(clearedCookie)?.[1]) < Date.now());
  const { rows } = await fixture.pool.query("SELECT token_hash FROM sessions");
  assert.deepEqual(rows, [{ token_hash: samSession.tokenHash }]);
  assert.equal((await request("/me", { headers: { Cookie: alexSession.cookie } })).status, 401);
  const samResponse = await request("/me", { headers: { Cookie: samSession.cookie } });
  assert.equal(samResponse.status, 200);
  assert.deepEqual(await samResponse.json(), { user: sam });
});

test("auth responses opt out of HTTP caching", async () => {
  const { response, cookie } = await signIn();
  assert.equal(response.headers.get("cache-control"), "no-store");
  const authenticated = await request("/me", { headers: { Cookie: cookie } });
  assert.equal(authenticated.headers.get("cache-control"), "no-store");
  assert.equal((await request("/me")).headers.get("cache-control"), "no-store");
});

test("a different browser origin cannot sign in or log out", async () => {
  const otherOrigin = "http://localhost:3001";
  const { cookie } = await signIn();
  const login = await loginRequest({ email: sam.email, password }, otherOrigin);
  const logout = await request("/logout", {
    method: "POST",
    headers: { Cookie: cookie, Origin: otherOrigin },
  });
  assert.deepEqual([login.status, logout.status], [403, 403]);
  assert.equal(login.headers.get("set-cookie"), null);
  assert.equal(logout.headers.get("set-cookie"), null);
  const { rows } = await fixture.pool.query("SELECT user_id FROM sessions");
  assert.deepEqual(rows, [{ user_id: alex.id }]);
  assert.equal((await request("/me", { headers: { Cookie: cookie } })).status, 200);
});

test("malformed login JSON gets a 400 without logging its body", async (t) => {
  const errorLog = t.mock.method(console, "error", () => {});
  const response = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"password":"synthetic-test-value",',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON." });
  assert.equal(errorLog.mock.callCount(), 0);
});
