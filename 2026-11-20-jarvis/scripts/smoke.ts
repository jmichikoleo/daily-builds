// Smoke-test a real agent in a throwaway project:
//   node scripts/smoke.ts claude|codex
// Turn 1: harmless reply. Turn 2: resume the same session.
// Turn 3: asks to create a file; any approval request is printed and DENIED.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClaudeAdapter } from '../src/server/agents/claude.ts';
import { createCodexAdapter } from '../src/server/agents/codex.ts';
import type { AgentAdapter, TurnSink } from '../src/server/agents/types.ts';

const which = process.argv[2];
const find = (bin: string) =>
  [path.join(os.homedir(), '.local/bin', bin), '/opt/homebrew/bin/' + bin, '/usr/local/bin/' + bin].find((p) => fs.existsSync(p)) ?? bin;
const adapter: AgentAdapter =
  which === 'codex' ? createCodexAdapter({ executable: find('codex') }) : createClaudeAdapter({ executable: find('claude') });

const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-smoke-')));
fs.writeFileSync(path.join(dir, 'README.md'), '# smoke test project\n');

console.log(`[smoke] ${adapter.label}:`, await adapter.check());
console.log(`[smoke] project: ${dir}`);

let sessionId: string | undefined;
async function turn(prompt: string) {
  let text = '';
  const sink: TurnSink = {
    session: (id) => (sessionId = id),
    delta: (t) => (text += t),
    progress: (t) => console.log(`  › ${t}`),
    notice: (l, t) => console.log(`  ! ${l}: ${t}`),
    approval: async (r) => {
      console.log(`  ? APPROVAL ${r.kind}: ${r.title} -> deny`);
      return 'deny';
    },
  };
  const started = Date.now();
  const out = await adapter.startTurn({ cwd: dir, prompt, sessionId }, sink).done;
  console.log(`[smoke] "${prompt}" -> ${JSON.stringify(out)} in ${((Date.now() - started) / 1000).toFixed(1)}s, session ${sessionId}`);
  console.log(`  reply: ${text.trim().slice(0, 300)}`);
  return out;
}

await turn('Reply with exactly: jarvis smoke ok');
const first = sessionId;
await turn('What exact phrase did you reply with in your previous message? Answer in one line.');
console.log(`[smoke] resumed same session: ${first === sessionId}`);
await turn('Create a file named hello.txt in this directory containing the word hi. Use your file tools.');
console.log(`[smoke] hello.txt exists after deny: ${fs.existsSync(path.join(dir, 'hello.txt'))}`);

// Cancel: start a slow task and stop it after a few seconds.
{
  let text = '';
  const sink: TurnSink = { session: () => {}, delta: (t) => (text += t), progress: () => {}, notice: () => {}, approval: async () => 'deny' };
  const h = adapter.startTurn({ cwd: dir, prompt: 'Write a 600-word story about a lighthouse keeper. No tools.', sessionId }, sink);
  await new Promise((r) => setTimeout(r, 4000));
  const t0 = Date.now();
  await h.cancel();
  const out = await h.done;
  console.log(`[smoke] cancel -> ${JSON.stringify(out)} ${Date.now() - t0}ms after cancel, ${text.length} chars streamed before stop`);
}
await turn('Reply with exactly: still here');
fs.rmSync(dir, { recursive: true, force: true });
