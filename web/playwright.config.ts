import { defineConfig, devices } from "@playwright/test"

import { API_PORT, API_URL, WEB_PORT, WEB_URL } from "./e2e/env.ts"

/*
 * Tests de bout en bout : vrai serveur FastAPI + vrai front (Vite). Pas de mock : les tests
 * envoient de vrais lots sur POST /ingest/batches, comme le ferait l'agent.
 * Ports dedies (voir e2e/env.ts) : les serveurs de developpement et `.env.local` ne sont
 * jamais utilises. Hors CI, des serveurs de test deja lances sur ces ports sont reutilises.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: "../server",
      url: `${API_URL}/health`,
      env: { SIMRACE_CORS_ORIGINS: WEB_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: WEB_URL,
      // une variable du processus l'emporte sur .env.local
      env: { VITE_API_URL: API_URL, VITE_MAX_STATIONS: "" },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
