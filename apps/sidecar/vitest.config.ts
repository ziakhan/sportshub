import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // env.ts fails fast on missing secrets at import time — provide test
    // values before any module loads. UTC pins the quiet-hours math.
    env: {
      SIDECAR_SHARED_SECRET: "test-shared-secret",
      AUTH_TOKEN_SECRET: "test-auth-secret",
      APP_TIMEZONE: "UTC",
    },
  },
})
