// Stand-in for `codex app-server` that speaks the same stdio JSON-RPC shape.
// Logs every client message to $FAKE_LOG so tests can check what Jarvis sent.
import fs from 'node:fs';
import readline from 'node:readline';

const log = (m) => process.env.FAKE_LOG && fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(m) + '\n');
const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
let thread = 'thread-new';
let turn = 'turn-1';
let pendingApproval = null;
let prompt = '';

log({ cwd: process.cwd() });

function finish(status, error) {
  send({ method: 'turn/completed', params: { threadId: thread, turn: { id: turn, items: [], status, error } } });
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const m = JSON.parse(line);
  log(m);
  if (m.method === 'initialize') return send({ id: m.id, result: { userAgent: 'fake' } });
  if (m.method === 'thread/start') {
    thread = 'thread-new';
    return send({ id: m.id, result: { thread: { id: thread }, approvalPolicy: 'on-request', cwd: m.params.cwd } });
  }
  if (m.method === 'thread/resume') {
    if (m.params.threadId === 'missing') return send({ id: m.id, error: { code: -32600, message: 'thread not found' } });
    thread = m.params.threadId;
    return send({ id: m.id, result: { thread: { id: thread }, approvalPolicy: 'on-request' } });
  }
  if (m.method === 'turn/start') {
    prompt = m.params.input[0].text;
    send({ id: m.id, result: { turn: { id: turn, items: [], status: 'inProgress' } } });
    send({ method: 'turn/started', params: { threadId: thread, turn: { id: turn, items: [], status: 'inProgress' } } });
    if (prompt.includes('unauthorized')) {
      send({ method: 'error', params: { threadId: thread, turnId: turn, willRetry: false, error: { message: '401 Unauthorized', codexErrorInfo: 'unauthorized' } } });
      return finish('failed', { message: '401 Unauthorized', codexErrorInfo: 'unauthorized' });
    }
    if (prompt.includes('crash')) process.exit(3);
    if (prompt.includes('wait')) return; // until turn/interrupt
    send({ method: 'item/started', params: { threadId: thread, turnId: turn, startedAtMs: Date.now(), item: { type: 'commandExecution', id: 'c1', command: 'npm test', cwd: process.cwd() } } });
    if (prompt.includes('ask')) {
      send({ id: 900, method: 'item/tool/requestUserInput', params: { threadId: thread, turnId: turn, itemId: 'q1', questions: [] } });
    }
    pendingApproval = 77;
    return send({ id: 77, method: 'item/commandExecution/requestApproval', params: { threadId: thread, turnId: turn, itemId: 'c1', startedAtMs: Date.now(), command: 'npm test', cwd: process.cwd(), reason: 'needs network' } });
  }
  if (m.method === 'turn/interrupt') {
    send({ id: m.id, result: {} });
    return finish('interrupted');
  }
  if (m.id === pendingApproval) {
    pendingApproval = null;
    const decision = m.result?.decision;
    for (const d of ['Ran ', `with decision ${decision} `, `in thread ${thread}.`])
      send({ method: 'item/agentMessage/delta', params: { threadId: thread, turnId: turn, itemId: 'a1', delta: d } });
    return finish('completed');
  }
});
