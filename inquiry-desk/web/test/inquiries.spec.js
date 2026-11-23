import { expect, test } from "@playwright/test";

const alex = { id: "alex", name: "Alex Morgan", email: "alex@example.test" };
const sam = { id: "sam", name: "Sam Lee", email: "sam@example.test" };
const input = {
  customerName: "Maya Perera",
  customerContact: "maya@example.test",
  subject: "Delivery question",
  description: "Asked for the delivery window.",
};
const labels = {
  customerName: "Customer name",
  customerContact: "Customer contact",
  subject: "Subject",
  description: "Description",
};
const inquiry = {
  ...input, id: "delivery", status: "New", createdAt: "2026-11-23T05:00:00.000Z",
};

async function openWorkspace(page, baseURL, { list = () => ({ json: { inquiries: [] } }), save } = {}) {
  await page.route(/\/api\/(?:auth\/(?:me|login)|inquiries)(?:\?.*)?$/, async (route) => {
    const headers = {
      "access-control-allow-origin": baseURL,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "content-type",
    };
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/auth/me") return route.fulfill({ headers, json: { user: alex } });
    if (url.pathname === "/api/auth/login") {
      const user = request.postDataJSON().email === sam.email ? sam : alex;
      return route.fulfill({ headers, json: { user } });
    }

    const result = request.method() === "POST" ? await save?.(request.postDataJSON()) : await list(url.searchParams);
    if (!result) return route.abort();
    return route.fulfill({ headers, ...result });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inquiries", exact: true })).toBeVisible();
}

async function fillInquiry(page, values = input) {
  for (const [name, value] of Object.entries(values)) {
    await page.getByLabel(labels[name], { exact: true }).fill(value);
  }
}

test("validates the form, prevents duplicate saves, and shows the saved inquiry", async ({ page, baseURL }) => {
  const pending = Promise.withResolvers();
  const submissions = [];
  await openWorkspace(page, baseURL, {
    list: (params) => ({ json: { inquiries: submissions.length && !params.size ? [inquiry] : [] } }),
    save: async (body) => {
      submissions.push(body);
      await pending.promise;
      return { status: 201, json: { inquiry } };
    },
  });

  await expect(page.getByText("No inquiries yet. Use the form to add one.")).toBeVisible();
  const save = page.getByRole("button", { name: "Save inquiry", exact: true });
  const customerName = page.getByLabel("Customer name", { exact: true });
  await save.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Enter a customer name");
  await expect(customerName).toBeFocused();
  expect(submissions).toHaveLength(0);

  await page.getByLabel("Status", { exact: true }).selectOption("Resolved");
  await expect(page.getByText("No inquiries match those filters.")).toBeVisible();
  await fillInquiry(page, { ...input, customerName: ` ${input.customerName} ` });
  try {
    await save.click();
    await expect(page.getByRole("button", { name: "Saving inquiry…" })).toBeDisabled();
    await page.getByLabel("Subject", { exact: true }).press("Enter");
  } finally {
    pending.resolve();
  }

  await expect(page.getByText("Inquiry saved.", { exact: true })).toBeFocused();
  const row = page.getByRole("listitem").filter({ hasText: input.subject });
  await expect(row).toContainText(input.customerName);
  await expect(row).toContainText("New");
  await expect(row.locator("time")).toHaveAttribute("datetime", inquiry.createdAt);
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("");
  await expect(customerName).toHaveValue("");
  expect(submissions).toEqual([input]);
});

test("preserves all fields after server validation and connection failures", async ({ page, baseURL }) => {
  let attempts = 0;
  await openWorkspace(page, baseURL, {
    save: () => ++attempts === 1 ? { status: 400, json: { error: "Check the customer contact." } } : null,
  });
  await fillInquiry(page);
  const save = page.getByRole("button", { name: "Save inquiry", exact: true });
  await save.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Check the customer contact.");
  await expect(save).toBeEnabled();

  await save.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Couldn’t reach Inquiry Desk.");
  await expect(save).toBeEnabled();
  for (const [name, value] of Object.entries(input)) {
    await expect(page.getByLabel(labels[name], { exact: true })).toHaveValue(value);
  }
});

test("search and status work together and show a filtered empty state", async ({ page, baseURL }) => {
  const queries = [];
  const resolved = { ...inquiry, id: "resolved", subject: "Previous delivery", status: "Resolved" };
  await openWorkspace(page, baseURL, {
    list: (params) => {
      const query = Object.fromEntries(params);
      queries.push(query);
      const inquiries = [inquiry, resolved].filter((record) =>
        (!query.q || record.subject.toLowerCase().includes(query.q.toLowerCase())) &&
        (!query.status || record.status === query.status));
      return { json: { inquiries } };
    },
  });
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await page.getByLabel("Search inquiries").fill("Previous");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Status", { exact: true }).selectOption("New");
  await expect(page.getByText("No inquiries match those filters.")).toBeVisible();
  expect(queries.at(-1)).toEqual({ q: "Previous", status: "New" });
});

test("lists an error and retries to the unfiltered empty state", async ({ page, baseURL }) => {
  let attempts = 0;
  await openWorkspace(page, baseURL, {
    list: () => ++attempts === 1
      ? { status: 500, json: { error: "Something went wrong." } }
      : { json: { inquiries: [] } },
  });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Couldn’t load inquiries. Something went wrong.");
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.getByText("No inquiries yet. Use the form to add one.")).toBeVisible();
});

test("an expired session offers sign-in and restores a draft only for its owner", async ({ page, baseURL }) => {
  await openWorkspace(page, baseURL, {
    save: () => ({ status: 401, json: { error: "Please sign in to continue." } }),
  });
  await fillInquiry(page);

  for (const user of [alex, sam]) {
    await page.getByRole("button", { name: "Save inquiry" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Your session expired. Sign in again to continue.");
    const email = page.getByLabel("Email address");
    await expect(email).toBeFocused();
    await email.fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(user.name, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Subject", { exact: true })).toHaveValue(user === alex ? input.subject : "");
  }
});
