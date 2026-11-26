// many-lives/scripts/serve.mjs: the live server, run by the launchd agent com.mochi.many-lives.
//   no auto reload. 127.0.0.1:4680 only, tailscale serve puts it on the tailnet at https :8680.
//   ML_DATA_DIR and ML_OWNER_LOGIN come from the launchd plist, which lives outside the repo.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { supervise } from "./supervise.mjs";

const backend = join(dirname(fileURLToPath(import.meta.url)), "..", "backend");
const port = process.env.ML_PORT || "4680";
supervise("many-lives", join(backend, ".venv/bin/python"), ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", port, "--workers", "1", "--no-proxy-headers"], { cwd: backend });
