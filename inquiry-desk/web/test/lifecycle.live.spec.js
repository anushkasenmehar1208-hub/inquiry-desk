import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("two browser tabs handle stale status, and another staff member cannot open the link", async ({ page, context }) => {
  test.skip(process.env.RUN_LIVE_E2E !== "1", "Needs running API, frontend and PostgreSQL.");
  const password = process.env.E2E_ALEX_PASSWORD;
  const otherPassword = process.env.E2E_SAM_PASSWORD;
  test.skip(!password || !otherPassword, "Set the two demo-user test passwords.");

  async function signIn(target, email, pass) {
    await target.getByLabel("Email address").fill(email);
    await target.getByLabel("Password", { exact: true }).fill(pass);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(target.getByRole("heading", { name: "Inquiries", exact: true })).toBeVisible();
  }

  await page.goto("/");
  await signIn(page, "alex@example.test", password);
  const subject = "Lifecycle verification " + randomUUID();
  await page.getByLabel("Customer name", { exact: true }).fill("Test Customer");
  await page.getByLabel("Customer contact", { exact: true }).fill("test@example.test");
  await page.getByLabel("Subject", { exact: true }).fill(subject);
  await page.getByLabel("Description", { exact: true }).fill("Testing stale status conflicts.");
  await page.getByRole("button", { name: "Save inquiry" }).click();
  await expect(page.getByText("Inquiry saved.", { exact: true })).toBeVisible();

  const link = page.getByRole("link", { name: "Open " + subject });
  const url = await link.getAttribute("href");
  await link.click();
  await expect(page.getByRole("button", { name: "Start progress" })).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto(url);
  await expect(secondTab.getByRole("button", { name: "Start progress" })).toBeVisible();

  await page.getByRole("button", { name: "Start progress" }).click();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toBeVisible();

  await secondTab.getByRole("button", { name: "Start progress" }).click();
  await expect(secondTab.getByRole("main").getByRole("alert")).toContainText("changed in another tab");
  await secondTab.getByRole("button", { name: "Refresh inquiry" }).click();
  await expect(secondTab.getByRole("button", { name: "Mark resolved" })).toBeVisible();
  await secondTab.getByRole("button", { name: "Mark resolved" }).click();
  await expect(secondTab.getByRole("button", { name: "Reopen inquiry" })).toBeVisible();
  await secondTab.close();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "sam@example.test", otherPassword);
  await page.goto(url);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("do not have access");
});
