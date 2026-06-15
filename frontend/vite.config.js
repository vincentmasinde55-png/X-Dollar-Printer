import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    host: true,       // expose on LAN (0.0.0.0) — useful for testing on mobile
    port: 5173,
    open: true,
    proxy: {
      // Forward API calls to the Django backend during development.
      // With this in place, src/services/api.js can use "/api" as its
      // base URL instead of "http://127.0.0.1:8000/api".
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false,
  },
});