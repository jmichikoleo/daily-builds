// studio/plugin.js
// the studio's little backend. it only runs inside the vite dev server (npm run dev or npm run studio),
// never on netlify. it can
//   POST /__studio/recipes   save the recipe list into src/recipes.js
//   POST /__studio/photo     save a photo into public/photos
//   GET  /__studio/status    say whether there are changes that aren't on the live site yet
//   POST /__studio/publish   build the site, put it on netlify, save the recipes to github

import { writeFile, rename, readFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { validate } from "../src/lib.js";
import { cleanRecipe, serializeRecipes } from "../src/serialize.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RECIPES_FILE = join(ROOT, "src/recipes.js");
const PHOTOS_DIR = join(ROOT, "public/photos");
const STATE_FILE = join(ROOT, ".studio-published");
const NETLIFY_SITE = "mochis-recipe-book";

// this computer, or a device on your own tailscale network
const ALLOWED_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.[a-z0-9-]+\.ts\.net)(:\d+)?$/i;
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// only accept requests made by the studio page itself
export function allowed(req) {
  const host = req.headers.host ?? "";
  if (!ALLOWED_HOST.test(host)) return false;
  const origin = req.headers.origin;
  if (!origin) return req.headers["sec-fetch-site"] === "same-origin";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("that file is too big"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve) => {
    // the studio runs in development mode. the build must not inherit that,
    // or the live site would get the studio buttons.
    const env = { ...process.env, NODE_ENV: "production" };
    const child = spawn(cmd, args, { cwd, env });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (err) => resolve({ code: 1, out: String(err) }));
    child.on("close", (code) => resolve({ code, out }));
  });
}

async function recipesHash() {
  const text = await readFile(RECIPES_FILE, "utf8");
  return createHash("sha256").update(text).digest("hex");
}

async function unpublished() {
  const last = await readFile(STATE_FILE, "utf8").catch(() => "");
  return last.trim() !== (await recipesHash());
}

// tell vite the recipe file changed and reload open pages.
// vite's file watcher can miss a save that replaces the file, so don't wait for it.
function refresh(server) {
  const graphs = [server.environments?.client?.moduleGraph, server.moduleGraph].filter(Boolean);
  for (const graph of graphs) {
    for (const mod of graph.getModulesByFile(RECIPES_FILE) ?? []) graph.invalidateModule(mod);
  }
  (server.environments?.client?.hot ?? server.ws).send({ type: "full-reload" });
}

let publishing = false;

// photos you uploaded and then took off a recipe shouldn't go online
async function removeUnusedPhotos() {
  const { recipes } = await import(`${RECIPES_FILE}?t=${Date.now()}`);
  const used = new Set(recipes.map((r) => r.photo).filter(Boolean).map((p) => p.replace(/^\.?\/?photos\//, "")));
  const files = await readdir(PHOTOS_DIR).catch(() => []);
  for (const f of files) {
    if (!f.startsWith(".") && !used.has(f)) await unlink(join(PHOTOS_DIR, f));
  }
}

async function publish() {
  const steps = [];
  await removeUnusedPhotos();
  const build = await run("npm", ["run", "build"]);
  steps.push({ step: "build", ok: build.code === 0 });
  if (build.code !== 0) return { ok: false, steps, error: "the build failed", log: build.out.slice(-1500) };

  // safety check. never ship the studio
  const built = await readdir(join(ROOT, "dist/assets")).catch(() => []);
  for (const f of built.filter((x) => x.endsWith(".js"))) {
    if ((await readFile(join(ROOT, "dist/assets", f), "utf8")).includes("/__studio")) {
      return { ok: false, steps, error: "the build still had studio code in it, so it wasn't published" };
    }
  }

  const deploy = await run("npx", ["--yes", "netlify-cli", "deploy", "--prod", "--no-build", "--dir", "dist", "--site", NETLIFY_SITE]);
  steps.push({ step: "netlify", ok: deploy.code === 0 });
  if (deploy.code !== 0) return { ok: false, steps, error: "netlify didn't take it", log: deploy.out.slice(-1500) };
  await writeFile(STATE_FILE, await recipesHash());

  // save the recipe file and photos to github. only these paths, nothing else in the repo.
  const top = (await run("git", ["rev-parse", "--show-toplevel"])).out.trim();
  let github = "skipped";
  if (top) {
    const paths = [relative(top, RECIPES_FILE), relative(top, PHOTOS_DIR)];
    await run("git", ["add", "--", ...paths], top);
    const staged = await run("git", ["diff", "--cached", "--quiet", "--", ...paths], top);
    if (staged.code === 0) {
      github = "nothing new";
    } else {
      const commit = await run("git", ["commit", "-m", "recipe-book: recipes from the studio", "--", ...paths], top);
      let push = commit.code === 0 ? await run("git", ["push"], top) : commit;
      if (commit.code === 0 && push.code !== 0) {
        await run("git", ["pull", "--rebase", "--autostash"], top);
        push = await run("git", ["push"], top);
      }
      github = push.code === 0 ? "saved" : "failed";
      if (push.code !== 0) steps.push({ step: "github", ok: false, log: push.out.slice(-800) });
    }
  }
  steps.push({ step: "github", ok: github !== "failed", result: github });
  return { ok: true, steps, github };
}

export default function studio() {
  return {
    name: "recipe-studio",
    apply: "serve",
    configureServer(server) {
      // serve photos straight from disk, so a fresh upload shows before vite notices the new file
      server.middlewares.use("/photos", async (req, res, next) => {
        const name = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "");
        const ext = name.split(".").pop().toLowerCase();
        const type = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[ext];
        if (!type || !/^[\w.-]+$/.test(name)) return next();
        try {
          const data = await readFile(join(PHOTOS_DIR, name));
          res.setHeader("Content-Type", type);
          res.end(data);
        } catch {
          next();
        }
      });

      server.middlewares.use("/__studio", async (req, res) => {
        const path = req.url.split("?")[0];
        if (!allowed(req)) return send(res, 403, { error: "not allowed" });
        try {
          if (req.method === "GET" && path === "/status") {
            return send(res, 200, { unpublished: await unpublished(), publishing });
          }
          if (req.method !== "POST") return send(res, 405, { error: "use POST" });

          if (path === "/recipes") {
            const body = JSON.parse((await readBody(req, 2_000_000)).toString("utf8"));
            const recipes = body.recipes.map(cleanRecipe);
            const categories = body.categories.map((c) => String(c).trim()).filter(Boolean);
            validate(recipes);
            const tmp = `${RECIPES_FILE}.tmp`;
            await writeFile(tmp, serializeRecipes(recipes, categories), "utf8");
            await rename(tmp, RECIPES_FILE);
            refresh(server);
            return send(res, 200, { ok: true });
          }

          if (path === "/photo") {
            const ext = PHOTO_TYPES[String(req.headers["content-type"]).split(";")[0]];
            if (!ext) return send(res, 400, { error: "use a jpg, png or webp photo" });
            const slug = new URL(req.url, "http://x").searchParams.get("slug")?.replace(/[^a-z0-9-]/g, "") || "photo";
            const data = await readBody(req, 15_000_000);
            const name = `${slug}-${Date.now().toString(36)}.${ext}`;
            await mkdir(PHOTOS_DIR, { recursive: true });
            await writeFile(join(PHOTOS_DIR, name), data);
            return send(res, 200, { ok: true, photo: `photos/${name}` });
          }

          if (path === "/publish") {
            if (publishing) return send(res, 409, { error: "already publishing, give it a minute" });
            publishing = true;
            try {
              const result = await publish();
              return send(res, result.ok ? 200 : 500, result);
            } finally {
              publishing = false;
            }
          }

          return send(res, 404, { error: "not found" });
        } catch (err) {
          return send(res, 400, { error: err.message });
        }
      });
    },
  };
}
