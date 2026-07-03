import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // *.int.test.ts hit the real database — they run via vitest.integration.config.ts
    exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
    // Pin the product timezone so DST-boundary scheduler tests (I14) exercise
    // the same wall-clock math on every machine and in CI.
    env: { TZ: "America/Toronto" },
  },
})
