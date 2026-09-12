import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * @june/shared from its TypeScript source. An alias keeps Vite in charge of the package (aliased
 * paths are never externalised to Node), which also resolves its .js-suffixed imports to .ts.
 */
export default defineConfig({
  resolve: { alias: { "@june/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)) } },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
})
