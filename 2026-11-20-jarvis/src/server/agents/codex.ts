import { execFile, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';
import type { AgentAdapter, ApprovalDecision, Availability, TurnHandle, TurnInput, TurnOutcome, TurnSink } from './types.ts';

export interface CodexOptions {
  executable: string;
  model?: string;
  approvalPolicy?: 'untrusted' | 'on-request';
  sandbox?: 'read-only' | 'workspace-write';
  /** Extra args before "app-server", only used by tests to point at a fake server. */
  argsOverride?: string[];
}

type Json = any;

/** Minimal JSON-RPC peer for `codex app-server` over stdio (one JSON object per line). */
class RpcPeer {
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: Json) => void; reject: (e: Error) => void }>();
  private child: ChildProcessWithoutNullStreams;
  onNotification: (method: string, params: Json) => void = () => {};
  onRequest: (method: string, params: Json) => Promise<{ result?: Json; error?: { code: number; message: string } }> = async () => ({
    error: { code: -32601, message: 'not supported by Jarvis' },
  });

  constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => this.handle(line));
  }

  private handle(line: string) {
    let msg: Json;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.id !== undefined && msg.method) {
      this.onRequest(msg.method, msg.params).then(
        (r) => this.write({ id: msg.id, ...r }),
        (e) => this.write({ id: msg.id, error: { code: -32603, message: String(e?.message ?? e) } }),
      );
    } else if (msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) {
      this.onNotification(msg.method, msg.params);
    }
  }

  write(obj: Json) {
    if (!this.child.stdin.writable) return;
    this.child.stdin.write(JSON.stringify(obj) + '\n');
  }

  request(method: string, params: Json, timeoutMs = 60_000): Promise<Json> {
    const id = this.nextId++;
    this.write({ id, method, params });
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`codex app-server did not answer ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
    });
  }

  notify(method: string, params?: Json) {
    this.write(params === undefined ? { method } : { method, params });
  }

  failAll(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }
}

function friendlyError(raw: string, info?: Json): string {
  if (info === 'unauthorized' || /unauthori[sz]ed|not logged in|login|401/i.test(raw))
    return `codex is not signed in on the mac mini. run codex login in a terminal there (${raw.slice(0, 160)})`;
  return raw;
}

function itemProgress(item: Json): string | undefined {
  switch (item?.type) {
    case 'commandExecution':
      return `$ ${item.command}`;
    case 'fileChange':
      return `editing ${(item.changes ?? []).map((c: Json) => c.path).filter(Boolean).slice(0, 3).join(', ') || 'files'}`;
    case 'mcpToolCall':
      return `tool ${item.server ?? ''} ${item.tool ?? ''}`.trim();
    case 'webSearch':
      return `searching ${item.query ?? ''}`;
    case 'plan':
      return 'updating plan';
    default:
      return undefined;
  }
}

export function createCodexAdapter(opts: CodexOptions): AgentAdapter {
  const args = opts.argsOverride ?? ['app-server'];
  return {
    id: 'codex',
    label: 'Codex',
    check(): Promise<Availability> {
      return new Promise((resolve) => {
        if (!fs.existsSync(opts.executable)) return resolve({ ok: false, reason: `codex not found at ${opts.executable}` });
        if (opts.argsOverride) return resolve({ ok: true, version: 'test' });
        execFile(opts.executable, ['--version'], { timeout: 15_000 }, (err, stdout) => {
          if (err) resolve({ ok: false, reason: `codex --version failed (${err.message})` });
          else resolve({ ok: true, version: stdout.trim() });
        });
      });
    },

    startTurn(input: TurnInput, sink: TurnSink): TurnHandle {
      let cancelled = false;
      let threadId: string | undefined;
      let turnId: string | undefined;
      let peer: RpcPeer | undefined;
      let child: ChildProcessWithoutNullStreams | undefined;

      const run = () =>
        new Promise<TurnOutcome>((resolve) => {
          let settled = false;
          let lastError: string | undefined;
          let lastErrorInfo: Json;
          // Resolve only once the app-server has exited, so the next turn can resume the
          // thread without hitting "thread already has an active writer".
          const settle = (o: TurnOutcome) => {
            if (settled) return;
            settled = true;
            const c = child;
            if (!c || c.exitCode !== null || c.signalCode !== null) return resolve(o);
            const force = setTimeout(() => c.kill('SIGKILL'), 3000);
            c.once('exit', () => {
              clearTimeout(force);
              resolve(o);
            });
            c.stdin.end();
            c.kill('SIGTERM');
          };

          try {
            // Spawned directly with structured args; the working directory is chosen by the server.
            child = spawn(opts.executable, args, { cwd: input.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
          } catch (err) {
            return settle({ status: 'error', error: `could not start codex (${(err as Error).message})` });
          }
          let stderrTail = '';
          child.stderr.on('data', (d) => (stderrTail = (stderrTail + d.toString()).slice(-2000)));
          child.on('error', (err: NodeJS.ErrnoException) => {
            peer?.failAll(new Error('codex app-server failed to start'));
            settle({ status: 'error', error: err.code === 'ENOENT' ? `codex not found at ${opts.executable}. check agents.codex.executable` : `codex failed to start (${err.message})` });
          });
          child.on('exit', (code, signal) => {
            peer?.failAll(new Error('codex app-server exited'));
            if (cancelled) return settle({ status: 'cancelled' });
            settle({ status: 'error', error: friendlyError(`codex app-server exited (${signal ?? code})${stderrTail ? ` ${stderrTail.trim().slice(-300)}` : ''}`) });
          });

          const p = new RpcPeer(child);
          peer = p;

          p.onNotification = (method, params) => {
            if (params?.threadId && threadId && params.threadId !== threadId) return;
            switch (method) {
              case 'item/agentMessage/delta':
                sink.delta(params.delta ?? '');
                break;
              case 'item/started': {
                const line = itemProgress(params.item);
                if (line) sink.progress(line);
                break;
              }
              case 'item/completed':
                if (params.item?.type === 'agentMessage') sink.delta('\n\n');
                break;
              case 'error':
                lastError = params.error?.message;
                lastErrorInfo = params.error?.codexErrorInfo;
                if (params.willRetry) sink.progress(`retrying (${lastError})`);
                break;
              case 'turn/completed': {
                const turn = params.turn ?? {};
                if (turn.status === 'completed') settle({ status: 'done' });
                else if (turn.status === 'interrupted') settle({ status: 'cancelled' });
                else {
                  const msg = turn.error?.message ?? lastError ?? 'codex turn failed';
                  settle({ status: 'error', error: friendlyError(msg, turn.error?.codexErrorInfo ?? lastErrorInfo) });
                }
                break;
              }
            }
          };

          const ask = async (req: Parameters<TurnSink['approval']>[0]): Promise<ApprovalDecision> => sink.approval(req);

          p.onRequest = async (method, params) => {
            switch (method) {
              case 'item/commandExecution/requestApproval': {
                const d = await ask({
                  kind: params.networkApprovalContext ? 'network' : 'command',
                  title: `run ${params.command ?? 'command'}`,
                  detail: [params.command, params.cwd ? `in ${params.cwd}` : '', params.reason ? `reason. ${params.reason}` : ''].filter(Boolean).join('\n'),
                });
                return { result: { decision: d === 'allow' ? 'accept' : 'decline' } };
              }
              case 'item/fileChange/requestApproval': {
                const d = await ask({
                  kind: 'file',
                  title: 'apply file changes',
                  detail: [params.reason, params.grantRoot ? `write access under ${params.grantRoot}` : ''].filter(Boolean).join('\n') || undefined,
                });
                return { result: { decision: d === 'allow' ? 'accept' : 'decline' } };
              }
              case 'execCommandApproval': {
                const cmd = Array.isArray(params.command) ? params.command.join(' ') : String(params.command);
                const d = await ask({ kind: 'command', title: `run ${cmd}`, detail: [cmd, `in ${params.cwd}`, params.reason].filter(Boolean).join('\n') });
                return { result: { decision: d === 'allow' ? 'approved' : 'denied' } };
              }
              case 'applyPatchApproval': {
                const d = await ask({ kind: 'file', title: 'apply patch', detail: params.reason ?? undefined });
                return { result: { decision: d === 'allow' ? 'approved' : 'denied' } };
              }
              case 'mcpServer/elicitation/request':
                sink.notice('warn', "codex asked for input from an mcp server. jarvis can't pass that form along so it was declined. use a codex terminal for this step");
                return { result: { action: 'decline' } };
              case 'item/tool/requestUserInput':
                sink.notice('warn', "codex asked you a question jarvis can't pass along. continue this step in a codex terminal");
                return { error: { code: -32601, message: 'Jarvis cannot answer user-input requests' } };
              case 'item/permissions/requestApproval':
                sink.notice('warn', 'codex asked for extra sandbox permissions. jarvis never grants those. approve it from a codex terminal if you want it');
                return { error: { code: -32601, message: 'Jarvis does not grant permission profiles' } };
              default:
                sink.notice('warn', `codex sent ${method}, which jarvis does not handle. use a terminal if the run stalls`);
                return { error: { code: -32601, message: `${method} is not supported by Jarvis` } };
            }
          };

          (async () => {
            try {
              await p.request('initialize', { clientInfo: { name: 'jarvis', title: 'Jarvis', version: '1.0.0' } }, 30_000);
              p.notify('initialized');
              const overrides: Json = { cwd: input.cwd };
              if (opts.model) overrides.model = opts.model;
              if (opts.approvalPolicy) overrides.approvalPolicy = opts.approvalPolicy;
              if (opts.sandbox) overrides.sandbox = opts.sandbox;
              const res = input.sessionId
                ? await p.request('thread/resume', { threadId: input.sessionId, excludeTurns: true, ...overrides })
                : await p.request('thread/start', overrides);
              threadId = res?.thread?.id;
              if (!threadId) throw new Error('codex app-server did not return a thread id');
              sink.session(threadId);
              sink.progress(`codex thread ...${threadId.slice(-8)} ready (${typeof res.approvalPolicy === 'string' ? res.approvalPolicy : 'custom'} approvals)`);
              if (cancelled) return settle({ status: 'cancelled' });
              const t = await p.request('turn/start', { threadId, input: [{ type: 'text', text: input.prompt, text_elements: [] }] });
              turnId = t?.turn?.id;
              if (cancelled && turnId) await p.request('turn/interrupt', { threadId, turnId }, 5000).catch(() => {});
            } catch (err) {
              if (cancelled) return settle({ status: 'cancelled' });
              const msg = (err as Error).message;
              settle({ status: 'error', error: friendlyError(input.sessionId && /thread|not found|rollout/i.test(msg) ? `could not resume the codex thread (${msg}). start a new session` : msg) });
            }
          })();
        });

      return {
        done: run(),
        async cancel() {
          cancelled = true;
          if (peer && threadId && turnId) {
            await peer.request('turn/interrupt', { threadId, turnId }, 5000).catch(() => {});
            setTimeout(() => child?.kill('SIGTERM'), 4000);
          } else {
            child?.kill('SIGTERM');
          }
        },
      };
    },
  };
}
