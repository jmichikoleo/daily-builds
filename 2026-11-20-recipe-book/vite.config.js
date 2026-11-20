// vite.config.js
// relative base so the built site works from any folder or static host.
// the studio plugin only exists while the dev server runs (npm run dev or npm run studio).
import { defineConfig } from "vite";
import studio from "./studio/plugin.js";

// npm run studio sets STUDIO_PUBLIC_PORT so live reload works through the tailscale address
const publicPort = Number(process.env.STUDIO_PUBLIC_PORT) || undefined;

export default defineConfig({
  base: "./",
  plugins: [studio()],
  server: {
    allowedHosts: [".ts.net"],
    hmr: publicPort ? { clientPort: publicPort, protocol: "wss" } : undefined,
  },
});
