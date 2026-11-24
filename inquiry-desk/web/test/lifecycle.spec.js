import { expect, test } from "@playwright/test";

const id = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const user = { id: "alex", name: "Alex Morgan", email: "alex@example.test" };

async function stubWorkspace(page, baseURL, { missing = false } = {}) {
  let current = {
    id, customerName: "Maya Perera", customerContact: "maya@example.test",
    subject: "Delivery question", description: "Need a delivery update.",
    status: "New", version: 1, createdAt: "2026-11-23T05:00:00.000Z",
    updatedAt: "2026-11-23T05:00:00.000Z",
  };
  const requests = [];
  const headers = {
    "access-control-allow-origin": baseURL,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET, POST, PATCH",
  };

  await page.route(/\/api\/(?:auth\/me|inquiries(?:\/[^?]*)?)(?:\?.*)?$/, (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (pathname === "/api/auth/me") return route.fulfill({ headers, json: { user } });
    if (pathname === "/api/inquiries") return route.fulfill({ headers, json: { inquiries: [current] } });
    if (pathname === `/api/inquiries/${id}` && !missing) {
      return route.fulfill({ headers, json: { inquiry: current } });
    }
    if (pathname === `/api/inquiries/${id}/status` && !missing) {
      const body = request.postDataJSON();
      requests.push(body);
      if (body.version !== current.version) {
        return route.fulfill({ status: 409, headers, json: { error: "This inquiry changed. Refresh it before updating." } });
      }
      current = { ...current, status: body.status, version: current.version + 1 };
      return route.fulfill({ headers, json: { inquiry: current } });
    }
    return route.fulfill({ status: 404, headers, json: { error: "Inquiry not found." } });
  });
  return {
    requests,
    updateBehindTheScenes() {
      current = { ...current, status: "In Progress", version: current.version + 1 };
    },
  };
}

test("opens an inquiry and handles a stale tab without overwriting it", async ({ page, baseURL }) => {
  const backend = await stubWorkspace(page, baseURL);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open Delivery question" })).toBeVisible();
  await page.getByRole("link", { name: "Open Delivery question" }).click();
  await expect(page).toHaveURL(new RegExp("inquiry=" + id));
  await expect(page.getByRole("heading", { name: "Inquiry details" })).toBeVisible();
  await expect(page.getByText("Need a delivery update.")).toBeVisible();

  backend.updateBehindTheScenes();
  await page.getByRole("button", { name: "Start progress" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("changed in another tab");
  await expect(page.getByRole("button", { name: "Start progress" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh inquiry" })).toBeVisible();

  await page.getByRole("button", { name: "Refresh inquiry" }).click();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Delivery question" })).toContainText("In Progress");
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByRole("button", { name: "Reopen inquiry" })).toBeVisible();
  expect(backend.requests).toEqual([
    { status: "In Progress", version: 1 },
    { status: "Resolved", version: 2 },
  ]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Reopen inquiry" })).toBeVisible();
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page).not.toHaveURL(/inquiry=/);
  await expect(page.getByRole("heading", { name: "Your inquiries" })).toBeFocused();
});

test("a direct link to another employee's inquiry shows a safe denial", async ({ page, baseURL }) => {
  await stubWorkspace(page, baseURL, { missing: true });
  await page.goto(`/?inquiry=${otherId}`);
  await expect(page.getByRole("heading", { name: "Inquiry details" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("do not have access");
  await expect(page.getByRole("button", { name: "Mark resolved" })).toHaveCount(0);
});

test("an invalid direct-link ID returns an understandable error", async ({ page, baseURL }) => {
  const headers = {
    "access-control-allow-origin": baseURL,
    "access-control-allow-credentials": "true",
  };
  await page.route(/\/api\/(?:auth\/me|inquiries(?:\/.*)?)(?:\?.*)?$/, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (path === "/api/auth/me") return route.fulfill({ headers, json: { user } });
    if (path === "/api/inquiries") return route.fulfill({ headers, json: { inquiries: [] } });
    return route.fulfill({ status: 400, headers, json: { error: "Invalid inquiry ID." } });
  });
  await page.goto("/?inquiry=not-a-uuid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("link is invalid");
});


test("dot-segment links are rejected before they can become a different API route", async ({ page, baseURL }) => {
  await stubWorkspace(page, baseURL);
  for (const invalid of [".", "..", "../auth/me"]) {
    await page.goto("/?inquiry=" + encodeURIComponent(invalid));
    await expect(page.getByRole("main").getByRole("alert")).toContainText("link is invalid");
    await expect(page.getByRole("button", { name: "Start progress" })).toHaveCount(0);
  }
});

test("the detail view remains usable at a narrow viewport", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await stubWorkspace(page, baseURL);
  await page.goto("/?inquiry=" + id);
  await expect(page.getByRole("heading", { name: "Inquiry details" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start progress" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Start progress" }).click();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toBeVisible();
});
