import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { describeTool } from '../src/server/agents/claude.ts';
import { createCodexAdapter } from '../src/server/agents/codex.ts';
import { createMockAdapter } from '../src/server/agents/mock.ts';
import type { ApprovalRequest, TurnSink } from '../src/server/agents/types.ts';
import { ConfigError, parseConfig } from '../src/server/config.ts';
import { RunManager } from '../src/server/runs.ts';
import { Store } from '../src/server/store.ts';
import { createTranscriber, inspectWav } from '../src/server/transcribe.ts';
import { makeWav, tmpDir } from './helpers.ts';

function recordingSink(decide: (r: ApprovalRequest) => 'allow' | 'deny' = () => 'allow') {
  const out = { session: [] as string[], text: '', progress: [] as string[], notices: [] as string[], approvals: [] as ApprovalRequest[] };
  const sink: TurnSink = {
    session: (id) => out.session.push(id),
    delta: (t) => (out.text += t),
    progress: (t) => out.progress.push(t),
    notice: (_l, t) => out.notices.push(t),
    approval: async (r) => {
      out.approvals.push(r);
      return decide(r);
    },
  };
  return { sink, out };
}

describe('codex adapter (against a fake app-server)', () => {
  const script = path.resolve('test/fake-codex-app-server.mjs');
  const make = () => {
    const dir = tmpDir();
    const logFile = path.join(dir, 'log.jsonl');
    process.env.FAKE_LOG = logFile;
    const adapter = createCodexAdapter({ executable: process.execPath, argsOverride: [script] });
    const messages = () => fs.readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    return { dir, adapter, messages };
  };

  test('starts a thread in the project dir, forwards an approval, streams the reply', async () => {
    const { dir, adapter, messages } = make();
    const { sink, out } = recordingSink(() => 'allow');
    const outcome = await adapter.startTurn({ cwd: dir, prompt: 'Jarvis, run the tests' }, sink).done;
    assert.deepEqual(outcome, { status: 'done' });
    assert.deepEqual(out.session, ['thread-new']);
    assert.equal(out.approvals[0].kind, 'command');
    assert.match(out.approvals[0].title, /npm test/);
    assert.match(out.text, /with decision accept/);
    assert.ok(out.progress.some((p) => p === '$ npm test'));
    const msgs = messages();
    assert.equal(msgs[0].cwd, dir, 'app-server is launched in the project directory');
    assert.deepEqual(msgs.map((m) => m.method).filter(Boolean).slice(0, 4), ['initialize', 'initialized', 'thread/start', 'turn/start']);
    assert.equal(msgs.find((m) => m.method === 'thread/start').params.approvalPolicy, undefined, 'does not override the user approval policy');
    assert.equal(msgs.find((m) => m.method === 'turn/start').params.input[0].text, 'Jarvis, run the tests');
  });

  test('deny is sent as decline; follow-ups resume the thread', async () => {
    const { dir, adapter, messages } = make();
    const { sink, out } = recordingSink(() => 'deny');
    await adapter.startTurn({ cwd: dir, prompt: 'again', sessionId: 'thread-abc' }, sink).done;
    assert.match(out.text, /decision decline in thread thread-abc/);
    const resume = messages().find((m) => m.method === 'thread/resume');
    assert.equal(resume.params.threadId, 'thread-abc');
  });

  test('cancel sends turn/interrupt and reports cancelled', async () => {
    const { dir, adapter, messages } = make();
    const { sink } = recordingSink();
    const h = adapter.startTurn({ cwd: dir, prompt: 'wait for me' }, sink);
    await new Promise((r) => setTimeout(r, 400));
    await h.cancel();
    assert.deepEqual(await h.done, { status: 'cancelled' });
    assert.ok(messages().some((m) => m.method === 'turn/interrupt' && m.params.turnId === 'turn-1'));
  });

  test('unsupported interactive requests produce a visible notice', async () => {
    const { dir, adapter } = make();
    const { sink, out } = recordingSink();
    await adapter.startTurn({ cwd: dir, prompt: 'ask me something' }, sink).done;
    assert.ok(out.notices.some((n) => /terminal/.test(n)));
  });

  test('auth failures, crashes, missing threads and missing executables are readable errors', async () => {
    const { dir, adapter } = make();
    const auth = await adapter.startTurn({ cwd: dir, prompt: 'unauthorized' }, recordingSink().sink).done;
    assert.equal(auth.status, 'error');
    assert.match((auth as any).error, /codex login/);
    const crash = await adapter.startTurn({ cwd: dir, prompt: 'crash' }, recordingSink().sink).done;
    assert.match((crash as any).error, /exited/);
    const gone = await adapter.startTurn({ cwd: dir, prompt: 'hi', sessionId: 'missing' }, recordingSink().sink).done;
    assert.match((gone as any).error, /start a new session/);
    const missing = createCodexAdapter({ executable: '/nope/codex' });
    assert.equal((await missing.check()).ok, false);
    const r = await missing.startTurn({ cwd: dir, prompt: 'hi' }, recordingSink().sink).done;
    assert.match((r as any).error, /not found/);
  });
});

describe('claude tool labels', () => {
  test('paths inside the project are shown relative to it', () => {
    assert.equal(describeTool('Edit', { file_path: '/p/app/src/a.ts' }, '/p/app'), 'Edit src/a.ts');
    assert.equal(describeTool('Write', { file_path: '/elsewhere/x.txt' }, '/p/app'), 'Write /elsewhere/x.txt');
    assert.equal(describeTool('Read', { file_path: '/p/application/a.ts' }, '/p/app'), 'Read /p/application/a.ts');
  });
});

describe('mock adapter', () => {
  test('asks for approval on fix prompts and respects deny', async () => {
    const mock = createMockAdapter({ stepMs: 5 });
    const a = recordingSink(() => 'deny');
    await mock.startTurn({ cwd: '/tmp/x', prompt: 'Jarvis, fix the code' }, a.sink).done;
    assert.equal(a.out.approvals.length, 1);
    assert.match(a.out.text, /left src\/app.ts alone/);
    const b = recordingSink();
    await mock.startTurn({ cwd: '/tmp/x', prompt: 'hello', sessionId: a.out.session[0] }, b.sink).done;
    assert.match(b.out.text, /turn 2 of session/);
  });
});

describe('run manager event buffer', () => {
  test('clients too far behind are told to resync', async () => {
    const dir = tmpDir();
    const mock = createMockAdapter({ stepMs: 1 });
    const store = new Store(path.join(dir, 'data'));
    const rm = new RunManager([{ id: 'p', name: 'p', path: dir }], [mock], store);
    const runSnap = rm.start('p', 'mock', 'hello there');
    await new Promise((r) => {
      rm.on('event', (e) => e.event.type === 'run.finished' && r(null));
    });
    // flood the buffer
    for (let i = 0; i < 3100; i++) (rm as any).emitEvent({ type: 'run.progress', runId: runSnap.id, text: String(i) });
    assert.equal(rm.eventsSince(1), null);
    assert.equal(rm.eventsSince(rm.currentSeq() - 5)!.length, 5);
  });
});

describe('config validation', () => {
  const base = (over: any = {}) => {
    const dir = tmpDir();
    return { dir, raw: { auth: { mode: 'tailscale', allowedLogins: ['me@github'] }, projects: [{ id: 'p', path: dir }], ...over } };
  };

  test('accepts a sane config and resolves real paths', () => {
    const { raw, dir } = base();
    const cfg = parseConfig(raw, dir);
    assert.equal(cfg.projects[0].path, fs.realpathSync(dir));
    assert.equal(cfg.host, '127.0.0.1');
  });

  test('rejects relative, missing, root and home project paths', () => {
    for (const p of ['relative/dir', '/definitely/not/here', '/', process.env.HOME])
      assert.throws(() => parseConfig({ ...base().raw, projects: [{ id: 'p', path: p }] }, '/'), ConfigError, String(p));
  });

  test('rejects non-loopback hosts, bad ids, bypass permission modes and missing logins', () => {
    assert.throws(() => parseConfig({ ...base().raw, host: '0.0.0.0' }, '/'), /loopback/);
    assert.throws(() => parseConfig({ ...base().raw, projects: [{ id: 'Bad Id', path: base().dir }] }, '/'), /lowercase/);
    assert.throws(() => parseConfig({ ...base().raw, agents: { claude: { permissionMode: 'bypassPermissions' } } }, '/'), /bypassPermissions is not allowed/);
    assert.throws(() => parseConfig({ ...base().raw, agents: { codex: { sandbox: 'danger-full-access' } } }, '/'), /sandbox/);
    assert.throws(() => parseConfig({ ...base().raw, agents: { codex: { approvalPolicy: 'never' } } }, '/'), /approvalPolicy/);
    assert.throws(() => parseConfig({ ...base().raw, auth: { mode: 'tailscale', allowedLogins: [] } }, '/'), /allowedLogins/);
    assert.throws(() => parseConfig({ ...base().raw, auth: { mode: 'token', token: 'short' } }, '/'), /24 characters/);
  });
});

describe('transcription', () => {
  test('whisper-cpp backend runs the configured command and deletes the temp audio', async () => {
    const dir = tmpDir();
    const fake = path.join(dir, 'whisper-cli');
    const seen = path.join(dir, 'seen.txt');
    fs.writeFileSync(fake, `#!/bin/sh\nfor a in "$@"; do last_f=$prev; prev=$a; [ "$last_f" = "-f" ] && echo "$a" > ${seen}; done\necho " [BLANK_AUDIO] Jarvis, fix the code."\n`, { mode: 0o755 });
    const model = path.join(dir, 'ggml-base.en.bin');
    fs.writeFileSync(model, 'x');
    const t = createTranscriber({ backend: 'whisper-cpp', command: fake, model, language: 'en', threads: 2, timeoutMs: 5000 });
    assert.equal(t.available, true);
    const text = await t.transcribe(makeWav(1.2));
    assert.equal(text, 'Jarvis, fix the code.');
    const audioPath = fs.readFileSync(seen, 'utf8').trim();
    assert.ok(audioPath.endsWith('.wav'));
    assert.equal(fs.existsSync(audioPath), false, 'temporary audio is removed after transcription');
  });

  test('missing whisper binary is reported as unavailable', async () => {
    const t = createTranscriber({ backend: 'whisper-cpp', command: '/nope/whisper-cli', model: '/nope/model.bin', language: 'en', threads: 2, timeoutMs: 5000 });
    assert.equal(t.available, false);
    await assert.rejects(t.transcribe(makeWav(1)), /not found/);
  });

  test('wav inspection', () => {
    assert.equal(Math.round(inspectWav(makeWav(2)).durationSec), 2);
    assert.throws(() => inspectWav(makeWav(0.1)), /empty/);
    assert.throws(() => inspectWav(makeWav(2, 16000, 0)), /silent/);
  });
});
