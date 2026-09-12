import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
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
  server: {
    proxy: { "/api": "http://localhost:3000" }
  }
})
