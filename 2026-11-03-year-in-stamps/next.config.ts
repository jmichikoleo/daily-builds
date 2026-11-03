import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every route is static, so the site ships as plain files (see netlify.toml).
  output: "export",
  // Cache Components needs a server (PPR); a static export has none.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
