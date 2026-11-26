// many-lives/scripts/supervise.mjs — keep one live server process up, restarting it within seconds if it exits.
//   Used by serve.mjs, which the launchd agents run (scripts/launchd/).
//   launchd's own KeepAlive respawn can be deferred by macOS for minutes ("pended nondemand spawn = inefficient"):
//   a SIGKILLed server stayed down past 30 s in the 2026-11-24 crash test. So the supervisor restarts it instead.
//   Quick repeated failures back off (2 s, 4 s ... up to 60 s). It is Node, not a shell script, because macOS privacy
//   rules let the node binary read ~/Desktop but not /bin/bash. launchd stopping the agent (SIGTERM, also what
//   lab-service.sh restart sends) stops the server and then the supervisor.
import { spawn } from "node:child_process";

export function supervise(name, command, args, options) {
  let child = null;
  let stopping = false;
  let delay = 2000;

  function start() {
    const started = Date.now();
    child = spawn(command, args, { stdio: "inherit", env: process.env, ...options });
    child.on("error", (err) => console.error(`${new Date().toISOString()} ${name} failed to start: ${err.message}`));
    child.on("exit", (code, signal) => {
      if (stopping) return process.exit(0);
      delay = Date.now() - started > 60_000 ? 2000 : Math.min(delay * 2, 60_000);
      console.log(`${new Date().toISOString()} ${name} exited (${signal ?? code}), restarting in ${delay / 1000}s`);
      setTimeout(start, delay);
    });
  }

  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      stopping = true;
      if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      else process.exit(0);
    });
  }
  start();
}
