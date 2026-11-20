import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { AgentAdapter, TurnInput, TurnSink } from '../src/server/agents/types.ts';
import { parseConfig } from '../src/server/config.ts';
import type { JarvisConfig } from '../src/server/config.ts';
import { createApp } from '../src/server/http.ts';
import { RunManager } from '../src/server/runs.ts';
import { Store } from '../src/server/store.ts';
import { createTranscriber } from '../src/server/transcribe.ts';

export const TOKEN = 'test-token-0123456789abcdefghij';

const made: string[] = [];
process.on('exit', () => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

export function tmpDir(prefix = 'jarvis-test-') {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  made.push(d);
  return d;
}

/** A controllable fake agent that records every turn it receives. */
export function fakeAgent(id: 'claude' | 'codex') {
  const calls: { input: TurnInput; sink: TurnSink; finish: (text?: string) => void; fail: (e: string) => void; cancelled: boolean }[] = [];
  let counter = 0;
  const adapter: AgentAdapter = {
    id,
    label: id === 'claude' ? 'Claude Code' : 'Codex',
    async check() {
      return { ok: true, version: 'fake' };
    },
    startTurn(input, sink) {
      let resolve!: (o: any) => void;
      const done = new Promise<any>((r) => (resolve = r));
      const call = {
        input,
        sink,
        cancelled: false,
        finish: (text?: string) => {
          if (text) sink.delta(text);
          resolve({ status: 'done' });
        },
        fail: (e: string) => resolve({ status: 'error', error: e }),
      };
      calls.push(call);
      sink.session(input.sessionId ?? `${id}-session-${++counter}`);
      return {
        done,
        async cancel() {
          call.cancelled = true;
          resolve({ status: 'cancelled' });
        },
      };
    },
  };
  return { adapter, calls };
}

export async function startTestServer(opts: { adapters: AgentAdapter[]; auth?: any; transcription?: any }) {
  const root = tmpDir();
  const pA = path.join(root, 'alpha');
  const pB = path.join(root, 'beta');
  fs.mkdirSync(pA);
  fs.mkdirSync(pB);
  const config: JarvisConfig = parseConfig(
    {
      dataDir: path.join(root, 'data'),
      auth: opts.auth ?? { mode: 'token', token: TOKEN },
      projects: [
        { id: 'alpha', name: 'Alpha', path: pA },
        { id: 'beta', name: 'Beta', path: pB },
      ],
      agents: { claude: { executable: '/bin/echo' }, codex: { executable: '/bin/echo' } },
      transcription: opts.transcription ?? { backend: 'mock' },
    },
    root,
  );
  const store = new Store(config.dataDir);
  const runs = new RunManager(config.projects, opts.adapters, store);
  const app = createApp({ config, runs, store, adapters: opts.adapters, transcriber: createTranscriber(config.transcription), publicDir: path.resolve('public') });
  const server = http.createServer(app.handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const headers = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${TOKEN}`, 'X-Jarvis': '1', ...extra });
  const json = async (method: string, p: string, body?: unknown, h?: Record<string, string>) => {
    const res = await fetch(base + p, {
      method,
      headers: h ?? headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as any };
  };

  return {
    base,
    config,
    runs,
    store,
    paths: { alpha: pA, beta: pB },
    headers,
    json,
    async close() {
      await runs.shutdown();
      store.flush();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export function makeWav(seconds: number, rate = 16000, amp = 0.3): Buffer {
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(i / 10) * amp * 0x7fff), 44 + i * 2);
  return buf;
}

export const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn: () => boolean, ms = 3000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting');
    await tick(10);
  }
}
