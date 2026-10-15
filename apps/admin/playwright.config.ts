import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ADMIN_BASE_URL || "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One worker: the tests share the admin account and the order list (the dashboard's
  // 100-order revenue window), so even repeated copies of a spec must not overlap.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
