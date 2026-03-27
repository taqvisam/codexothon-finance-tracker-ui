import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const shouldStartWebServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER !== "true" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: shouldStartWebServer
    ? {
        command: "npm run dev",
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: true
      }
    : undefined
});
