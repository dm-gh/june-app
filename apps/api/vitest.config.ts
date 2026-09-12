import { defineConfig } from "vitest/config"

export default defineConfig({
  // @june/shared from its TypeScript source, ahead of Vite's default server conditions.
  resolve: { conditions: ["june-source", "module", "node", "development|production"] },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
})
