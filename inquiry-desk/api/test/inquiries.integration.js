import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { setupIntegrationApp } from "./support/integration-app.js";

const fixture = setupIntegrationApp();
const inquiryInput = {
  customerName: "Maya Perera",
  customerContact: "maya@example.test",
  subject: "Deposit of 50%_due",
  description: "Asked about the warranty.",
};

let alexCookie;
let samCookie;

beforeEach(async () => {
  await fixture.pool.query("DELETE FROM inquiries; DELETE FROM sessions");
  ({ cookie: alexCookie } = await fixture.signIn());
  ({ cookie: samCookie } = await fixture.signIn(fixture.sam.email));
});

function postInquiry(body, { cookie = alexCookie, origin = fixture.webOrigin } = {}) {
  return fixture.request("/inquiries", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function createInquiry(body = inquiryInput, options) {
  const response = await postInquiry(body, options);
  assert.equal(response.status, 201);
  const { inquiry } = await response.json();
  return inquiry;
}

async function listInquiries(query = {}, cookie = alexCookie) {
  const params = new URLSearchParams(query);
  const response = await fixture.request(`/inquiries?${params}`, { headers: { Cookie: cookie } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { inquiries } = await response.json();
  return inquiries;
}

test("inquiry creation and listing require a staff session", async () => {
  const responses = await Promise.all([
    postInquiry(inquiryInput, { cookie: null }),
    fixture.request("/inquiries"),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Please sign in to continue." });
  }
  assert.deepEqual(await listInquiries(), []);
});

test("creating an inquiry trims the fields and persists a New record for the session owner", async () => {
  const padded = Object.fromEntries(
    Object.entries(inquiryInput).map(([name, value]) => [name, `  ${value}  `]),
  );
  const inquiry = await createInquiry({ ...padded, ownerId: fixture.sam.id, status: "Resolved" });
  assert.match(inquiry.id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(inquiry, {
    id: inquiry.id,
    ...inquiryInput,
    status: "New",
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.createdAt,
  });
  assert.ok(Number.isFinite(Date.parse(inquiry.createdAt)));

  const { rows } = await fixture.pool.query(
    `SELECT owner_id, customer_name, customer_contact, subject, description, status
     FROM inquiries WHERE id = $1`,
    [inquiry.id],
  );
  assert.deepEqual(rows, [{
    owner_id: fixture.alex.id,
    customer_name: inquiryInput.customerName,
    customer_contact: inquiryInput.customerContact,
    subject: inquiryInput.subject,
    description: inquiryInput.description,
    status: "New",
  }]);
  assert.deepEqual(await listInquiries(), [inquiry]);
  assert.deepEqual(await listInquiries({}, samCookie), []);
});

test("creation rejects missing, blank, non-text, and overlong fields", async () => {
  for (const name of Object.keys(inquiryInput)) {
    const response = await postInquiry({ ...inquiryInput, [name]: undefined });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }

  const invalidBodies = [
    undefined,
    { ...inquiryInput, customerName: " \t\n " },
    { ...inquiryInput, customerName: "a".repeat(121) },
    { ...inquiryInput, customerContact: 123 },
    { ...inquiryInput, customerContact: "a".repeat(201) },
    { ...inquiryInput, subject: ["Text"] },
    { ...inquiryInput, subject: "a".repeat(201) },
    { ...inquiryInput, description: "a".repeat(4001) },
    { ...inquiryInput, description: "Text\u0000with a null character" },
  ];
  for (const body of invalidBodies) {
    const response = await postInquiry(body);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.deepEqual(await listInquiries(), []);
});

test("oversized request bodies get a client error", async () => {
  const response = await postInquiry({ ...inquiryInput, description: "a".repeat(40_000) });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Request body is too large." });
});

test("separate valid submissions with identical text create separate inquiries", async () => {
  const first = await createInquiry();
  const second = await createInquiry();
  assert.notEqual(first.id, second.id);
  assert.equal((await listInquiries()).length, 2);
});

test("listing is newest first and stays scoped to the authenticated employee", async () => {
  const older = await createInquiry();
  await fixture.pool.query("UPDATE inquiries SET created_at = now() - interval '1 day' WHERE id = $1", [older.id]);
  const newer = await createInquiry({ ...inquiryInput, subject: "Newer deposit inquiry" });
  const other = await createInquiry({ ...inquiryInput, subject: "Another employee's deposit" }, { cookie: samCookie });

  assert.deepEqual((await listInquiries()).map(({ id }) => id), [newer.id, older.id]);
  assert.deepEqual(await listInquiries({}, samCookie), [other]);
  assert.deepEqual(await listInquiries({ q: "another employee" }), []);
  assert.deepEqual((await listInquiries({ q: "deposit" })).map(({ id }) => id), [newer.id, older.id]);

  const response = await fixture.request(`/inquiries?ownerId=${fixture.sam.id}`, {
    headers: { Cookie: alexCookie },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Use only the q and status query parameters." });
});

test("search matches each inquiry field case-insensitively and treats punctuation literally", async () => {
  const match = await createInquiry();
  await createInquiry({
    customerName: "Jack Silva",
    customerContact: "+94 77 123 4567",
    subject: "Deposit of 50 USD",
    description: "Jack's order confirmation",
  });

  for (const q of ["  MAYA ", "EXAMPLE.TEST", "50%_DUE", "WARRANTY"]) {
    assert.deepEqual(await listInquiries({ q }), [match]);
  }
  assert.deepEqual(await listInquiries({ q: "not present" }), []);
  assert.equal((await listInquiries({ q: " \t " })).length, 2);
  assert.equal((await listInquiries({ q: "Jack's" })).length, 1);
});

test("the status filter accepts each status and combines with text search", async () => {
  const open = await createInquiry();
  const active = await createInquiry({ ...inquiryInput, subject: "Active billing case" });
  const resolved = await createInquiry({ ...inquiryInput, subject: "Resolved billing case" });
  await createInquiry({ ...inquiryInput, subject: "Other employee's billing case" }, { cookie: samCookie });
  await fixture.pool.query("UPDATE inquiries SET status = $1 WHERE id = $2", ["In Progress", active.id]);
  await fixture.pool.query("UPDATE inquiries SET status = $1 WHERE id = $2", ["Resolved", resolved.id]);

  for (const [status, id] of [["New", open.id], ["In Progress", active.id], ["Resolved", resolved.id]]) {
    assert.deepEqual((await listInquiries({ status })).map((inquiry) => inquiry.id), [id]);
  }
  assert.deepEqual((await listInquiries({ status: " In Progress ", q: "billing" })).map(({ id }) => id), [active.id]);
  assert.deepEqual(await listInquiries({ status: "Resolved", q: "active" }), []);
});

test("listing validates filter parameters and rejects repeated values", async () => {
  const invalidQueries = [
    "status=Open", "status=", "status=New&status=Resolved",
    "q=first&q=second", "q=%00", `q=${"a".repeat(121)}`,
    "q%5B%5D=term",
  ];
  for (const query of invalidQueries) {
    const response = await fixture.request(`/inquiries?${query}`, { headers: { Cookie: alexCookie } });
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("creation rejects an unapproved browser origin", async () => {
  const response = await postInquiry(inquiryInput, { origin: "http://localhost:3001" });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Request origin is not allowed." });
  assert.deepEqual(await listInquiries(), []);
});

test("database errors on create and list return a generic 500", async (t) => {
  const log = t.mock.method(console, "error", () => {});
  await fixture.pool.query("ALTER TABLE inquiries RENAME TO unavailable_inquiries");
  try {
    const responses = await Promise.all([
      postInquiry(inquiryInput),
      fixture.request("/inquiries", { headers: { Cookie: alexCookie } }),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: "Something went wrong. Please try again." });
    }
    assert.equal(log.mock.callCount(), 2);
  } finally {
    await fixture.pool.query("ALTER TABLE unavailable_inquiries RENAME TO inquiries");
  }
});

function detailRequest(id, cookie = alexCookie) {
  return fixture.request(`/inquiries/${id}`, { headers: cookie ? { Cookie: cookie } : {} });
}

function statusRequest(id, body, { cookie = alexCookie, origin = fixture.webOrigin } = {}) {
  return fixture.request(`/inquiries/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test("detail requires a session and returns the owner record with a version", async () => {
  const created = await createInquiry();
  const denied = await detailRequest(created.id, null);
  assert.equal(denied.status, 401);
  const response = await detailRequest(created.id);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { inquiry } = await response.json();
  assert.deepEqual(inquiry, { ...created, version: 1 });
});

test("detail and update reject invalid IDs, missing records, and other staff", async () => {
  const created = await createInquiry();
  const missingId = "11111111-1111-4111-8111-111111111111";

  for (const response of [
    await detailRequest("not-a-uuid"),
    await statusRequest("not-a-uuid", { status: "In Progress", version: 1 }),
  ]) {
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid inquiry ID." });
  }

  for (const id of [created.id, missingId]) {
    const response = await detailRequest(id, samCookie);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Inquiry not found." });
    const update = await statusRequest(id, { status: "In Progress", version: 1 }, { cookie: samCookie });
    assert.equal(update.status, 404);
    assert.deepEqual(await update.json(), { error: "Inquiry not found." });
  }
  assert.equal((await detailRequest(missingId)).status, 404);
  assert.equal((await statusRequest(created.id, { status: "In Progress", version: 1 }, { cookie: null })).status, 401);
});

test("updates follow New -> In Progress -> Resolved -> In Progress with incrementing versions", async () => {
  const created = await createInquiry();
  for (const [status, version] of [["In Progress", 1], ["Resolved", 2], ["In Progress", 3]]) {
    const response = await statusRequest(created.id, { status, version });
    assert.equal(response.status, 200);
    const { inquiry } = await response.json();
    assert.equal(inquiry.id, created.id);
    assert.equal(inquiry.status, status);
    assert.equal(inquiry.version, version + 1);
    assert.equal(inquiry.createdAt, created.createdAt);
  }
  const { inquiry } = await (await detailRequest(created.id)).json();
  assert.equal(inquiry.status, "In Progress");
  assert.equal(inquiry.version, 4);
  assert.deepEqual((await listInquiries()).map(({ status }) => status), ["In Progress"]);
});

test("updates reject illegal transitions, malformed versions and unexpected payload", async () => {
  const created = await createInquiry();
  const bad = [
    { status: "Resolved", version: 1 },
    { status: "New", version: 1 },
    { status: "Invalid", version: 1 },
    { status: "In Progress" },
    { status: "In Progress", version: 0 },
    { status: "In Progress", version: 2147483648 },
    { status: "In Progress", version: "1" },
    { status: "In Progress", version: 1, ownerId: fixture.sam.id },
    {},
  ];
  for (const body of bad) {
    const response = await statusRequest(created.id, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof (await response.json()).error, "string");
  }
  const { inquiry } = await (await detailRequest(created.id)).json();
  assert.equal(inquiry.status, "New");
  assert.equal(inquiry.version, 1);
});

test("a stale tab cannot overwrite a newer update", async () => {
  const created = await createInquiry();
  const firstTab = (await (await detailRequest(created.id)).json()).inquiry;
  const secondTab = (await (await detailRequest(created.id)).json()).inquiry;
  assert.equal(firstTab.version, secondTab.version);

  const first = await statusRequest(created.id, { status: "In Progress", version: firstTab.version });
  assert.equal(first.status, 200);
  const stale = await statusRequest(created.id, { status: "In Progress", version: secondTab.version });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).error, /Refresh/);
  const refreshed = (await (await detailRequest(created.id)).json()).inquiry;
  assert.equal(refreshed.status, "In Progress");
  assert.equal(refreshed.version, 2);
});

test("concurrent writes with the same version allow exactly one update", async () => {
  const created = await createInquiry();
  const [one, two] = await Promise.all([
    statusRequest(created.id, { status: "In Progress", version: 1 }),
    statusRequest(created.id, { status: "In Progress", version: 1 }),
  ]);
  assert.deepEqual([one.status, two.status].sort(), [200, 409]);
  assert.equal((await (await detailRequest(created.id)).json()).inquiry.version, 2);
});

test("status PATCH rejects an untrusted Origin before changing data", async () => {
  const created = await createInquiry();
  const response = await statusRequest(created.id, { status: "In Progress", version: 1 }, {
    origin: "http://localhost:9999",
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Request origin is not allowed." });
  assert.equal((await (await detailRequest(created.id)).json()).inquiry.status, "New");
});


test("valid text with JSON escaping still fits the request limit", async () => {
  const description = "x" + "\u0001".repeat(3998) + "x";
  const inquiry = await createInquiry({ ...inquiryInput, description });
  assert.equal(inquiry.description, description);
});

test("a malformed URL escape is a client error, not a server error", async () => {
  const response = await detailRequest("%ZZ");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid request path." });
});
