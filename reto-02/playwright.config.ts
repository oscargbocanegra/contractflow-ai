import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 20000,
  outputDir: "out/playwright-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173/api/health",
    reuseExistingServer: false,
    timeout: 30000,
    env: { OPENAI_API_KEY: "" },
  },
});
