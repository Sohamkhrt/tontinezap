import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "TontineZap — Tontine Lightning",
        short_name: "TontineZap",
        description: "Zero-custody rotating savings circles on Bitcoin Lightning + Nostr.",
        lang: "fr",
        theme_color: "#0b5d3b",
        background_color: "#fbf8f1",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // Never cache faucet / price / wallet traffic — only the static shell.
        navigateFallback: "/index.html",
      },
    }),
  ],
  build: { target: "es2022", sourcemap: false, chunkSizeWarningLimit: 400 },
  test: { environment: "node" },
} as never);
