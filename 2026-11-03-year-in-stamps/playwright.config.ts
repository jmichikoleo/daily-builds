import { defineConfig, devices } from "@playwright/test";

const PORT = 3510;

/**
 * Browser-level tests run against a production build. They use the locally
 * installed Google Chrome (`channel: "chrome"`), so no browser download is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, grep: /@mobile/ },
  ],
  webServer: {
    // The site is a static export; serve out/ with Netlify's own dev server so
    // netlify.toml rewrites and headers (including the CSP) are exercised too.
    command: `npm run build && npx --yes netlify-cli@27.16.2 dev --offline --framework '#static' --dir out --port ${PORT} --no-open`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
