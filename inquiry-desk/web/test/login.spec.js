import { expect, test } from "@playwright/test";

test("a rejected sign-in preserves the email and lets staff try again", async ({ page, baseURL }) => {
  await page.route("**/api/auth/**", (route) => {
    const headers = {
      "access-control-allow-origin": baseURL,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET, POST",
      "access-control-allow-headers": "content-type",
    };
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });

    const error = request.method() === "POST"
      ? "Incorrect email or password."
      : "Please sign in to continue.";
    return route.fulfill({ status: 401, headers, json: { error } });
  });

  await page.goto("/");
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password", { exact: true });
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });

  await email.fill("staff@example.test");
  await password.fill("invalid-password");
  await password.press("Enter");

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Incorrect email or password.");
  await expect(email).toHaveValue("staff@example.test");
  await expect(password).toHaveValue("");
  await expect(password).toBeFocused();
  await expect(signIn).toBeEnabled();
});
