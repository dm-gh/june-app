import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defaultClientConditions, defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // The api lives on the same origin: an OAuth callback or a capture URL must reach the server,
      // never be answered with the cached app shell.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      manifest: {
        name: "June",
        short_name: "June",
        description: "Personal finance tracker",
        theme_color: "#CEF366",
        background_color: "#FFFDF5",
        display: "standalone",
        icons: []
      }
    })
  ],
  // In development @june/shared resolves to its TypeScript source; builds and production use its dist.
  resolve: { conditions: ["june-source", ...defaultClientConditions] },
  server: {
    proxy: { "/api": "http://localhost:3000" }
  }
})
