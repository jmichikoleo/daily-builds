import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 5342)

export default defineConfig({
  testDir: 'e2e',
  timeout: Number(process.env.E2E_TIMEOUT ?? 8 * 60_000),
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`,
    channel: process.env.E2E_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    actionTimeout: 6_000,
    viewport: { width: 1280, height: 860 },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && node server/index.ts`,
        url: `http://127.0.0.1:${PORT}/healthz`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: { NODE_ENV: 'production', PORT: String(PORT), HOST: '127.0.0.1' },
      },
})
