// many-lives/scripts/dev.mjs: development server. python api with auto reload on :4686, serving the built frontend.
//   data goes to ~/Library/Application Support/many-lives-dev unless ML_DATA_DIR is set. never the live data.
//   for frontend work run `npm run dev` in frontend/ as well (vite on :4687 proxies /api here).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const port = process.env.ML_PORT || "4686";
const child = spawn(join(backend, ".venv/bin/python"), ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port, "--reload", "--reload-dir", "app", "--no-proxy-headers"],
  { cwd: backend, stdio: "inherit", env: { ML_SCHEDULER: "0", ...process.env } });
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill("SIGTERM"));
child.on("exit", (c) => process.exit(c ?? 0));
