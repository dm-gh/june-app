import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defaultClientConditions, defaultServerConditions } from "vite"
import { defineConfig } from "vitest/config"

/**
 * Two projects. `unit` runs the pure modules (lib, analysis, list items, schedule words) in Node.
 * `browser` renders components in headless Chromium and compares screenshots against the
 * references in `__screenshots__` next to each test; run `pnpm test:update` after an intended
 * visual change. Both resolve @june/shared from its TypeScript source, as the dev server does.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ["june-source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["june-source", ...defaultServerConditions] } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" }
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.tsx"],
          setupFiles: ["src/test/setup.browser.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            viewport: { width: 390, height: 844 }
          }
        }
      }
    ]
  }
})
