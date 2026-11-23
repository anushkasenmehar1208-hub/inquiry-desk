import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("real database inquiry workflow and staff isolation", async ({ page }) => {
  test.skip(process.env.RUN_LIVE_E2E !== "1", "Opt-in: requires running Express and seeded PostgreSQL.");

  const alexPassword = process.env.E2E_ALEX_PASSWORD;
  const samPassword = process.env.E2E_SAM_PASSWORD;
  test.skip(!alexPassword || !samPassword, "Set E2E_ALEX_PASSWORD and E2E_SAM_PASSWORD.");

  const subject = "Live verification " + randomUUID();
  async function login(email, password) {
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Inquiries", exact: true })).toBeVisible();
  }

  await page.goto("/");
  await login("alex@example.test", alexPassword);
  await page.getByRole("button", { name: "Save inquiry", exact: true }).click();
  await expect(page.locator("#inquiry-save-error")).toContainText("Enter a customer name");

  await page.getByLabel("Customer name", { exact: true }).fill("Test Customer");
  await page.getByLabel("Customer contact", { exact: true }).fill("test@example.test");
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page.getByLabel("Description", { exact: true }).fill("Testing the inquiry workflow");
  await page.getByRole("button", { name: "Save inquiry", exact: true }).click();

  await expect(page.getByText("Inquiry saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: subject })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: subject })).toBeVisible();

  await page.getByLabel("Search inquiries").fill(subject);
  await page.getByLabel("Status", { exact: true }).selectOption("New");
  await expect(page.getByRole("listitem").filter({ hasText: subject })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await login("sam@example.test", samPassword);
  await page.getByLabel("Search inquiries").fill(subject);
  await expect(page.getByText("No inquiries match those filters.")).toBeVisible();
});
