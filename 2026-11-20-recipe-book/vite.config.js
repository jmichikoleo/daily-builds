// vite.config.js
// relative base so the built site works from any folder or static host.
// the recipeEditor plugin only exists while `npm run dev` runs. it lets the editor save to src/recipes.js.
import { defineConfig } from "vite";
import { writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validate } from "./src/lib.js";
import { cleanRecipe, serializeRecipes } from "./src/serialize.js";

const RECIPES_FILE = fileURLToPath(new URL("./src/recipes.js", import.meta.url));
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function recipeEditor() {
  return {
    name: "recipe-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__recipes", (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        };
        if (req.method !== "POST") return send(405, { error: "use POST" });
        // only accept saves from this dev server's own page
        const origin = req.headers.origin ? new URL(req.headers.origin).host : "";
        if (!LOCAL.test(req.headers.host ?? "") || origin !== req.headers.host) {
          return send(403, { error: "not allowed" });
        }
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 1_000_000) req.destroy();
        });
        req.on("end", async () => {
          try {
            const body = JSON.parse(raw);
            const recipes = body.recipes.map(cleanRecipe);
            const categories = body.categories.map((c) => String(c).trim()).filter(Boolean);
            validate(recipes);
            const tmp = `${RECIPES_FILE}.tmp`;
            await writeFile(tmp, serializeRecipes(recipes, categories), "utf8");
            await rename(tmp, RECIPES_FILE);
            send(200, { ok: true });
          } catch (err) {
            send(400, { error: err.message });
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [recipeEditor()],
});
