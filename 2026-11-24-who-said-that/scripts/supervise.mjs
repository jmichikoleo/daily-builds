#!/usr/bin/env node
/**
 * What the launchd services run: keeps one server process up, restarting it
 * within seconds if it exits or crashes.
 *
 *   node scripts/supervise.mjs <node args...>
 *
 * launchd's own KeepAlive respawn can be deferred by macOS for minutes
 * ("pended nondemand spawn = inefficient"): in a crash test on 2026-11-24 a
 * killed server was still down after 30 s. So this supervisor restarts it.
 * Quick repeated failures back off (2 s, 4 s ... up to 60 s). It is Node, not
 * a shell script, because macOS privacy rules let the node binary read
 * ~/Desktop but not /bin/bash. launchd stopping the service (SIGTERM) stops
 * the server and then the supervisor.
 */
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/supervise.mjs <node args...>");
  process.exit(64);
}
let child = null;
let stopping = false;
let delay = 2000;

function start() {
  const started = Date.now();
  child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    if (stopping) return process.exit(0);
    delay = Date.now() - started > 60_000 ? 2000 : Math.min(delay * 2, 60_000);
    console.log(`${new Date().toISOString()} ${args.join(" ")} exited (${signal ?? code}), restarting in ${delay / 1000}s`);
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
