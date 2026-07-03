import path from "node:path"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

/**
 * L2 integration harness (docs/test-architecture.md §1) — route handlers
 * invoked directly against the REAL local Postgres, with worlds from
 * @youthbasketballhub/test-worlds built per suite and destroyed after.
 * Only the session is mocked (see src/test/integration-harness.ts).
 *
 * Run: npm run test:integration (from apps/web)
 * CI: same command against the docker postgres service.
 */
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Workspace packages ship TS source (main: src/index.ts) — alias them
      // so vite transforms rather than externalizes.
      "@youthbasketballhub/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
      "@youthbasketballhub/test-worlds": path.resolve(
        __dirname,
        "../../packages/test-worlds/src/index.ts"
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    // DATABASE_URL comes from .env.local locally; in CI the workflow env
    // wins because loadEnv only returns keys present in env files.
    env: { ...loadEnv(mode, __dirname, ""), TZ: "America/Toronto" },
    // Suites share one database — run files sequentially. Worlds are
    // runId-namespaced so this is about write-load predictability, not
    // correctness; suites must still use unique seeds.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
}))
