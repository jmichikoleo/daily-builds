import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClaudeAdapter } from './agents/claude.ts';
import { createCodexAdapter } from './agents/codex.ts';
import { createMockAdapter } from './agents/mock.ts';
import type { AgentAdapter } from './agents/types.ts';
import { ConfigError, loadConfig } from './config.ts';
import { createApp } from './http.ts';
import { RunManager } from './runs.ts';
import { Store } from './store.ts';
import { createTranscriber } from './transcribe.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError || err instanceof SyntaxError) {
    console.error(`[jarvis] config error: ${err.message}`);
    process.exit(1);
  }
  throw err;
}

const adapters: AgentAdapter[] = [];
if (config.agents.claude.enabled) adapters.push(createClaudeAdapter(config.agents.claude));
if (config.agents.codex.enabled) adapters.push(createCodexAdapter(config.agents.codex));
if (config.agents.mock.enabled) adapters.push(createMockAdapter());

const store = new Store(config.dataDir);
const runs = new RunManager(config.projects, adapters, store);
const app = createApp({ config, runs, store, adapters, transcriber: createTranscriber(config.transcription), publicDir: path.join(root, 'public') });

const server = http.createServer(app.handler);
server.requestTimeout = 0; // SSE streams stay open
server.headersTimeout = 30_000;

server.listen(config.port, config.host, async () => {
  const where = config.host === '::1' ? `[::1]` : config.host;
  console.log(`[jarvis] bridge on http://${where}:${config.port} (loopback only)`);
  console.log(`[jarvis] auth: ${config.auth.mode}${config.auth.mode === 'tailscale' ? ` (${config.auth.allowedLogins.join(', ')})` : ''}`);
  console.log(`[jarvis] projects: ${config.projects.map((p) => p.id).join(', ')}`);
  await app.refreshAvailability(true);
  for (const a of adapters) {
    const r = await a.check();
    console.log(`[jarvis] ${a.label}: ${r.ok ? `ok ${r.version ?? ''}` : `unavailable (${r.reason})`}`);
  }
  if (config.auth.mode === 'token' && process.env.JARVIS_MOCK === '1')
    console.log(`[jarvis] mock mode: open http://localhost:${config.port}/auth?token=${encodeURIComponent(config.auth.token)}`);
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  console.log('[jarvis] stopping, cancelling active runs');
  await Promise.race([runs.shutdown(), new Promise((r) => setTimeout(r, 7000))]);
  store.flush();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
