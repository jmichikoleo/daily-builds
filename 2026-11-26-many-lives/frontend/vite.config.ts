// frontend/vite.config.ts: dev server on :4687, api calls go to the python server on :4686.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", proxy: { "/api": "http://127.0.0.1:4686" } },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 900 },
});
