import { defineConfig } from "@playwright/test";

const live = process.env.RUN_LIVE_E2E === "1";
const baseURL = live ? "http://localhost:3000" : "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./test",
  use: { baseURL },
  webServer: live ? undefined : {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
  },
});
