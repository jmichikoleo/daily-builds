import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fakeAgent, makeWav, startTestServer, tick, waitFor } from './helpers.ts';

describe('bridge', () => {
  let srv: Awaited<ReturnType<typeof startTestServer>>;
  let claude: ReturnType<typeof fakeAgent>;
  let codex: ReturnType<typeof fakeAgent>;

  before(async () => {
    claude = fakeAgent('claude');
    codex = fakeAgent('codex');
    srv = await startTestServer({ adapters: [claude.adapter, codex.adapter] });
  });
  after(() => srv.close());
  beforeEach(async () => {
    // finish anything left from the previous test
    for (const c of [...claude.calls, ...codex.calls]) c.finish();
    await tick(30);
    claude.calls.length = 0;
    codex.calls.length = 0;
  });

  test('config lists project ids and names only, never paths', async () => {
    const { status, body } = await srv.json('GET', '/api/config');
    assert.equal(status, 200);
    assert.deepEqual(body.projects, [
      { id: 'alpha', name: 'Alpha' },
      { id: 'beta', name: 'Beta' },
    ]);
    assert.ok(!JSON.stringify(body).includes(srv.paths.alpha));
    assert.equal(body.defaultAgent, 'claude');
  });

  test('transcript submission routes to the server-chosen project directory', async () => {
    const { status, body } = await srv.json('POST', '/api/runs', { projectId: 'beta', agent: 'claude', prompt: 'Jarvis, fix the code.' });
    assert.equal(status, 202);
    assert.equal(body.run.status, 'working');
    assert.equal(claude.calls.length, 1);
    assert.equal(claude.calls[0].input.cwd, srv.paths.beta);
    assert.equal(claude.calls[0].input.prompt, 'Jarvis, fix the code.');
    claude.calls[0].finish('fixed');
    await waitFor(() => srv.runs.snapshot(body.run.id)?.status === 'done');
    assert.equal(srv.runs.snapshot(body.run.id)?.reply, 'fixed');
  });

  test('browser cannot pick a path: unknown project ids and extra fields are ignored or refused', async () => {
    const bad = await srv.json('POST', '/api/runs', { projectId: '../etc', agent: 'claude', prompt: 'hi' });
    assert.equal(bad.status, 404);
    const sneaky = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'hi', cwd: '/', path: '/etc' });
    assert.equal(sneaky.status, 202);
    assert.equal(claude.calls.at(-1)!.input.cwd, srv.paths.alpha);
    const agent = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'bash', prompt: 'ls' });
    assert.equal(agent.status, 400);
  });

  test('empty and oversized prompts are refused', async () => {
    assert.equal((await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: '   ' })).status, 400);
    assert.equal((await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'x'.repeat(8001) })).status, 400);
  });

  test('no concurrent runs in one project, double submit returns the same run', async () => {
    const first = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'one', clientRequestId: 'req-1' });
    const again = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'one', clientRequestId: 'req-1' });
    assert.equal(again.status, 202);
    assert.equal(again.body.run.id, first.body.run.id);
    assert.equal(claude.calls.length, 1, 'retried submit must not start a second turn');

    const other = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'codex', prompt: 'two' });
    assert.equal(other.status, 409);
    assert.equal(other.body.error.code, 'project_busy');

    const elsewhere = await srv.json('POST', '/api/runs', { projectId: 'beta', agent: 'codex', prompt: 'three' });
    assert.equal(elsewhere.status, 202, 'a different project can run at the same time');
  });

  test('sessions are separate per project and agent; follow-ups resume; new session starts fresh', async () => {
    const run = async (projectId: string, agent: 'claude' | 'codex', fake: ReturnType<typeof fakeAgent>) => {
      const r = await srv.json('POST', '/api/runs', { projectId, agent, prompt: `hi ${projectId} ${agent}` });
      assert.equal(r.status, 202, JSON.stringify(r.body));
      const call = fake.calls.at(-1)!;
      call.finish('ok');
      await waitFor(() => srv.runs.snapshot(r.body.run.id)?.status === 'done');
      return call.input.sessionId;
    };
    srv.runs.resetSession('alpha', 'claude');
    srv.runs.resetSession('alpha', 'codex');
    srv.runs.resetSession('beta', 'claude');

    assert.equal(await run('alpha', 'claude', claude), undefined, 'first turn is fresh');
    const alphaClaude = srv.store.get('alpha', 'claude').sessionId;
    assert.ok(alphaClaude);
    assert.equal(await run('alpha', 'claude', claude), alphaClaude, 'follow-up resumes the same session');
    assert.equal(await run('alpha', 'codex', codex), undefined, 'switching agents does not reuse the claude session');
    assert.equal(await run('beta', 'claude', claude), undefined, 'another project has its own session');
    assert.notEqual(srv.store.get('beta', 'claude').sessionId, alphaClaude);

    const state = await srv.json('GET', '/api/state');
    assert.equal(state.body.sessions['alpha::claude'].history.length, 4);
    assert.equal(state.body.sessions['alpha::codex'].history.length, 2);

    assert.equal((await srv.json('POST', '/api/sessions/reset', { projectId: 'alpha', agent: 'claude' })).status, 200);
    assert.equal(await run('alpha', 'claude', claude), undefined, 'new session starts fresh');
    assert.equal(srv.store.get('alpha', 'codex').sessionId !== undefined, true, 'resetting claude leaves codex alone');
  });

  test('cancel stops the run and frees the project', async () => {
    const r = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'long task' });
    const cancel = await srv.json('POST', `/api/runs/${r.body.run.id}/cancel`, {});
    assert.equal(cancel.status, 202);
    await waitFor(() => srv.runs.snapshot(r.body.run.id)?.status === 'cancelled');
    assert.equal(claude.calls.at(-1)!.cancelled, true);
    const next = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'next' });
    assert.equal(next.status, 202);
  });

  test('approvals: surfaced, answered once, and denied automatically on cancel', async () => {
    const r = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'edit' });
    const call = claude.calls.at(-1)!;
    const decision = call.sink.approval({ kind: 'command', title: 'Bash npm test', detail: 'npm test' });
    const snap = srv.runs.snapshot(r.body.run.id)!;
    assert.equal(snap.status, 'approval');
    const id = snap.approvals[0].id;

    assert.equal((await srv.json('POST', `/api/approvals/${id}`, { decision: 'maybe' })).status, 400);
    assert.equal((await srv.json('POST', `/api/approvals/${id}`, { decision: 'allow' })).status, 200);
    assert.equal(await decision, 'allow');
    assert.equal(srv.runs.snapshot(r.body.run.id)!.status, 'working');
    assert.equal((await srv.json('POST', `/api/approvals/${id}`, { decision: 'deny' })).status, 404, 'cannot answer twice');

    const second = call.sink.approval({ kind: 'file', title: 'Edit a.ts' });
    await srv.json('POST', `/api/runs/${r.body.run.id}/cancel`, {});
    assert.equal(await second, 'deny', 'pending approvals resolve to deny when the run is cancelled');
  });

  test('event stream replays missed events after a disconnect without resending the prompt', async () => {
    const seqBefore = srv.runs.currentSeq();
    const r = await srv.json('POST', '/api/runs', { projectId: 'beta', agent: 'claude', prompt: 'stream please' });
    const call = claude.calls.at(-1)!;
    call.sink.progress('Reading files');
    call.sink.delta('Hello ');
    // "disconnected" here: client reconnects with Last-Event-ID = seqBefore
    const ctrl = new AbortController();
    const res = await fetch(`${srv.base}/api/events`, { headers: { ...srv.headers(), 'Last-Event-ID': String(seqBefore) }, signal: ctrl.signal });
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    const reader = res.body!.getReader();
    let text = '';
    call.sink.delta('world');
    call.finish();
    const dec = new TextDecoder();
    while (!text.includes('run.finished')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value);
    }
    ctrl.abort();
    const events = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => JSON.parse(l.slice(6)));
    const types = events.map((e) => e.type);
    assert.deepEqual(types.slice(0, 3), ['run.started', 'run.progress', 'run.delta']);
    assert.ok(types.includes('run.finished'));
    assert.equal(events.filter((e) => e.type === 'run.delta').map((e) => e.text).join(''), 'Hello world');
    assert.equal(claude.calls.filter((c) => c.input.prompt === 'stream please').length, 1);

    // state endpoint recovers the finished run for a client that missed everything
    const state = await srv.json('GET', '/api/state');
    assert.ok(state.body.runs.some((x: any) => x.id === r.body.run.id && x.status === 'done' && x.reply === 'Hello world'));
  });

  test('agent errors are reported and the project unlocks', async () => {
    const r = await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'codex', prompt: 'x' });
    codex.calls.at(-1)!.fail('Codex is not signed in on the Mac mini.');
    await waitFor(() => srv.runs.snapshot(r.body.run.id)?.status === 'error');
    assert.match(srv.runs.snapshot(r.body.run.id)!.error!, /not signed in/);
    assert.equal(srv.runs.activeRunFor('alpha'), undefined);
  });

  test('transcription accepts WAV and rejects empty or non-WAV audio', async () => {
    const post = (body: Buffer, type = 'audio/wav') => fetch(`${srv.base}/api/transcribe`, { method: 'POST', headers: srv.headers({ 'Content-Type': type }), body: new Uint8Array(body) });
    const ok = await post(makeWav(1.5));
    assert.equal(ok.status, 200);
    assert.match((await ok.json()).text, /Jarvis, fix the code/);
    const empty = await post(makeWav(0.1));
    assert.equal(empty.status, 422);
    assert.equal((await empty.json()).error.code, 'empty_recording');
    const webm = await post(Buffer.from('not audio'), 'audio/webm');
    assert.equal(webm.status, 415);
    const junk = await post(Buffer.from('definitely not a wav file at all, nope, nothing here'));
    assert.equal(junk.status, 415);
  });
});

describe('auth and request hygiene', () => {
  test('token mode: no token, no access; pairing sets an HttpOnly cookie', async () => {
    const { adapter } = fakeAgent('claude');
    const srv = await startTestServer({ adapters: [adapter] });
    try {
      assert.equal((await fetch(`${srv.base}/api/config`)).status, 401);
      assert.equal((await fetch(`${srv.base}/`)).status, 401);
      assert.equal((await fetch(`${srv.base}/api/config`, { headers: { Authorization: 'Bearer wrong-token-wrong-token-wrong' } })).status, 401);
      const pair = await fetch(`${srv.base}/auth?token=${encodeURIComponent('test-token-0123456789abcdefghij')}`, { redirect: 'manual' });
      assert.equal(pair.status, 303);
      const cookie = pair.headers.get('set-cookie')!;
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/);
      assert.ok(!cookie.includes('test-token-0123456789abcdefghij'), 'cookie does not contain the raw token');
      const page = await fetch(`${srv.base}/`, { headers: { Cookie: cookie.split(';')[0] } });
      assert.equal(page.status, 200);
      assert.match(page.headers.get('content-security-policy')!, /default-src 'self'/);
    } finally {
      await srv.close();
    }
  });

  test('writes need the X-Jarvis header and a same-origin Origin', async () => {
    const { adapter } = fakeAgent('claude');
    const srv = await startTestServer({ adapters: [adapter] });
    try {
      const body = JSON.stringify({ projectId: 'alpha', agent: 'claude', prompt: 'hi' });
      const noHeader = await fetch(`${srv.base}/api/runs`, { method: 'POST', headers: { Authorization: 'Bearer test-token-0123456789abcdefghij', 'Content-Type': 'application/json' }, body });
      assert.equal(noHeader.status, 403);
      const cross = await fetch(`${srv.base}/api/runs`, { method: 'POST', headers: { ...srv.headers({ 'Content-Type': 'application/json' }), Origin: 'https://evil.example' }, body });
      assert.equal(cross.status, 403);
    } finally {
      await srv.close();
    }
  });

  test('tailscale mode: only allowed tailnet logins get in', async () => {
    const { adapter } = fakeAgent('claude');
    const srv = await startTestServer({ adapters: [adapter], auth: { mode: 'tailscale', allowedLogins: ['me@github'] } });
    try {
      assert.equal((await fetch(`${srv.base}/api/config`)).status, 401);
      assert.equal((await fetch(`${srv.base}/api/config`, { headers: { 'Tailscale-User-Login': 'someone@github' } })).status, 401);
      const viaServe = await fetch(`${srv.base}/api/runs`, {
        method: 'POST',
        headers: { 'Tailscale-User-Login': 'me@github', 'X-Jarvis': '1', 'Content-Type': 'application/json', Origin: 'https://mini.tail0000.ts.net:8480' },
        body: JSON.stringify({ projectId: 'alpha', agent: 'claude', prompt: 'via serve' }),
      });
      assert.equal(viaServe.status, 202, 'a tailnet https origin is accepted even if Serve rewrites Host');
      const ok = await fetch(`${srv.base}/api/config`, { headers: { 'Tailscale-User-Login': 'Me@GitHub' } });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).user, 'me@github');
    } finally {
      await srv.close();
    }
  });

  test('transcription unavailable gives a clear 503', async () => {
    const { adapter } = fakeAgent('claude');
    const srv = await startTestServer({ adapters: [adapter], transcription: { backend: 'none' } });
    try {
      const res = await fetch(`${srv.base}/api/transcribe`, { method: 'POST', headers: srv.headers({ 'Content-Type': 'audio/wav' }), body: new Uint8Array(makeWav(1)) });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).error.code, 'transcription_unavailable');
      // typed prompts still work
      assert.equal((await srv.json('POST', '/api/runs', { projectId: 'alpha', agent: 'claude', prompt: 'typed' })).status, 202);
    } finally {
      await srv.close();
    }
  });
});
