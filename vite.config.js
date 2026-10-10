import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon.svg"],
      manifest: {
        name: "iSense",
        short_name: "iSense",
        description:
          "Making campus navigation more inclusive with sensory-aware, personalized routes.",
        start_url: "/",
        display: "standalone",
        theme_color: "#2f6f6a",
        background_color: "#ffffff",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    // Vitest config (see tests/). Most unit tests are pure JS and need no DOM,
    // but jsdom is available for component tests later.
    environment: "node",
    include: ["tests/**/*.test.{js,jsx}"],
  },
});
