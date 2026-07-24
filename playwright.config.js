import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5199",
    // CI/container images may pre-install Chromium outside Playwright's
    // per-version cache; honor it when present.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "npm run dev",
    port: 5199,
    reuseExistingServer: true,
  },
});
