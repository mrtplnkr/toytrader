import { defineConfig, devices } from "@playwright/test";
import { CRA_PORT, EMULATOR_HOSTS } from "./e2e/helpers/constants";

export default defineConfig({
  testDir: "./e2e",
  // Two full sign-ins, two Omniva barcode registrations (each with a 1s
  // debounced search), and a full post -> receive -> pay round trip push
  // well past a 30s budget - see toy-swap.spec.ts.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${CRA_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // Firestore requires a local Java install; auth/storage/functions do not.
      command:
        "npm --prefix functions run build && firebase emulators:start --only auth,firestore,storage,functions",
      url: `http://${EMULATOR_HOSTS.firestore}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npm start",
      url: `http://localhost:${CRA_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        REACT_APP_USE_FIREBASE_EMULATORS: "true",
        BROWSER: "none",
      },
    },
  ],
});
