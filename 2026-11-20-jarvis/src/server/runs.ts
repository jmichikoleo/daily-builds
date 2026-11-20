import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { AgentAdapter, AgentId, ApprovalDecision, ApprovalRequest, TurnHandle, TurnOutcome } from './agents/types.ts';
import type { ProjectConfig } from './config.ts';
import type { Store } from './store.ts';

export type RunStatus = 'working' | 'approval' | 'done' | 'error' | 'cancelled';

export interface PendingApproval extends ApprovalRequest {
  id: string;
  runId: string;
}

export interface RunSnapshot {
  id: string;
  projectId: string;
  agent: AgentId;
  prompt: string;
  status: RunStatus;
  reply: string;
  progress: string[];
  notices: { level: 'info' | 'warn'; text: string }[];
  approvals: PendingApproval[];
  error?: string;
  startedAt: number;
  finishedAt?: number;
  resumed: boolean;
}

export type JarvisEvent =
  | { type: 'run.started'; run: RunSnapshot }
  | { type: 'run.delta'; runId: string; text: string }
  | { type: 'run.progress'; runId: string; text: string }
  | { type: 'run.notice'; runId: string; level: 'info' | 'warn'; text: string }
  | { type: 'run.approval'; runId: string; approval: PendingApproval }
  | { type: 'run.approval.resolved'; runId: string; approvalId: string; decision: ApprovalDecision }
  | { type: 'run.finished'; run: RunSnapshot }
  | { type: 'session.reset'; projectId: string; agent: AgentId };

export interface SeqEvent {
  seq: number;
  event: JarvisEvent;
}

export class RunError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ActiveRun {
  snap: RunSnapshot;
  handle?: TurnHandle;
  waiters: Map<string, (d: ApprovalDecision) => void>;
  cancelRequested: boolean;
}

const BUFFER = 3000;
const CANCEL_GRACE_MS = 6000;
const DEDUPE_MS = 10 * 60_000;

export class RunManager extends EventEmitter {
  private seq = 0;
  private buffer: SeqEvent[] = [];
  private runs = new Map<string, ActiveRun>();
  /** projectId -> runId of the run holding that project. */
  private locks = new Map<string, string>();
  /** clientRequestId -> runId, so a retried submit never starts a second run. */
  private requests = new Map<string, { runId: string; at: number }>();
  /** Last finished run per (project, agent) for the collapsed reply preview. */
  private lastByKey = new Map<string, string>();

  private projects: Map<string, ProjectConfig>;
  private adapters: Map<AgentId, AgentAdapter>;
  private store: Store;

  constructor(projects: ProjectConfig[], adapters: AgentAdapter[], store: Store) {
    super();
    this.setMaxListeners(100);
    this.projects = new Map(projects.map((p) => [p.id, p]));
    this.adapters = new Map(adapters.map((a) => [a.id, a]));
    this.store = store;
  }

  currentSeq() {
    return this.seq;
  }

  /** Events after `since`, or null if they fell out of the buffer (client must resync). */
  eventsSince(since: number): SeqEvent[] | null {
    if (since >= this.seq) return [];
    const first = this.buffer[0]?.seq ?? this.seq + 1;
    if (since < first - 1) return null;
    return this.buffer.filter((e) => e.seq > since);
  }

  private emitEvent(event: JarvisEvent) {
    const e = { seq: ++this.seq, event };
    this.buffer.push(e);
    if (this.buffer.length > BUFFER) this.buffer.splice(0, this.buffer.length - BUFFER);
    this.emit('event', e);
  }

  snapshot(runId: string): RunSnapshot | undefined {
    return this.runs.get(runId)?.snap;
  }

  /** Active runs plus the latest finished run for each (project, agent). */
  visibleRuns(): RunSnapshot[] {
    const ids = new Set([...this.locks.values(), ...this.lastByKey.values()]);
    return [...ids].map((id) => this.runs.get(id)?.snap).filter((s): s is RunSnapshot => !!s);
  }

  activeRunFor(projectId: string): RunSnapshot | undefined {
    const id = this.locks.get(projectId);
    return id ? this.runs.get(id)?.snap : undefined;
  }

  start(projectId: string, agent: AgentId, prompt: string, clientRequestId?: string): RunSnapshot {
    const now = Date.now();
    for (const [k, v] of this.requests) if (now - v.at > DEDUPE_MS) this.requests.delete(k);
    if (clientRequestId) {
      const prev = this.requests.get(clientRequestId);
      if (prev) {
        const snap = this.runs.get(prev.runId)?.snap;
        if (snap) return snap;
      }
    }

    const project = this.projects.get(projectId);
    if (!project) throw new RunError(404, 'unknown_project', 'that project is not in the jarvis allowlist');
    const adapter = this.adapters.get(agent);
    if (!adapter) throw new RunError(400, 'agent_unavailable', `${agent} is not turned on in the bridge`);
    const busy = this.activeRunFor(projectId);
    if (busy) throw new RunError(409, 'project_busy', `${this.adapters.get(busy.agent)?.label ?? busy.agent} is already working in ${project.name}`);

    const rec = this.store.get(projectId, agent);
    const snap: RunSnapshot = {
      id: randomUUID(),
      projectId,
      agent,
      prompt,
      status: 'working',
      reply: '',
      progress: [],
      notices: [],
      approvals: [],
      startedAt: now,
      resumed: !!rec.sessionId,
    };
    const run: ActiveRun = { snap, waiters: new Map(), cancelRequested: false };
    this.runs.set(snap.id, run);
    this.locks.set(projectId, snap.id);
    if (clientRequestId) this.requests.set(clientRequestId, { runId: snap.id, at: now });
    this.store.push(projectId, agent, { role: 'user', text: prompt, ts: now, runId: snap.id });
    this.emitEvent({ type: 'run.started', run: { ...snap } });

    const sink = {
      session: (id: string) => {
        if (this.store.get(projectId, agent).sessionId !== id) this.store.setSessionId(projectId, agent, id);
      },
      delta: (text: string) => {
        if (!text || this.isFinished(snap)) return;
        snap.reply += text;
        this.emitEvent({ type: 'run.delta', runId: snap.id, text });
      },
      progress: (text: string) => {
        if (this.isFinished(snap)) return;
        const line = text.replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!line) return;
        snap.progress.push(line);
        if (snap.progress.length > 40) snap.progress.shift();
        this.emitEvent({ type: 'run.progress', runId: snap.id, text: line });
      },
      notice: (level: 'info' | 'warn', text: string) => {
        snap.notices.push({ level, text });
        this.emitEvent({ type: 'run.notice', runId: snap.id, level, text });
      },
      approval: (req: ApprovalRequest) => this.requestApproval(run, req),
    };

    let handle: TurnHandle;
    try {
      handle = adapter.startTurn({ cwd: project.path, prompt, sessionId: rec.sessionId }, sink);
    } catch (err) {
      this.finish(run, { status: 'error', error: errorText(err) });
      return { ...snap };
    }
    run.handle = handle;
    handle.done.then(
      (outcome) => this.finish(run, outcome),
      (err) => this.finish(run, { status: 'error', error: errorText(err) }),
    );
    return { ...snap };
  }

  private isFinished(snap: RunSnapshot) {
    return snap.status === 'done' || snap.status === 'error' || snap.status === 'cancelled';
  }

  private requestApproval(run: ActiveRun, req: ApprovalRequest): Promise<ApprovalDecision> {
    if (run.cancelRequested || this.isFinished(run.snap)) return Promise.resolve('deny');
    const approval: PendingApproval = {
      id: randomUUID(),
      runId: run.snap.id,
      kind: req.kind,
      title: req.title.slice(0, 160),
      detail: req.detail?.slice(0, 4000),
    };
    run.snap.approvals.push(approval);
    run.snap.status = 'approval';
    this.emitEvent({ type: 'run.approval', runId: run.snap.id, approval });
    return new Promise((resolve) => run.waiters.set(approval.id, resolve));
  }

  resolveApproval(approvalId: string, decision: ApprovalDecision) {
    for (const run of this.runs.values()) {
      const waiter = run.waiters.get(approvalId);
      if (!waiter) continue;
      this.settleApproval(run, approvalId, decision);
      return;
    }
    throw new RunError(404, 'approval_gone', 'that approval is no longer pending');
  }

  private settleApproval(run: ActiveRun, approvalId: string, decision: ApprovalDecision) {
    const waiter = run.waiters.get(approvalId);
    if (!waiter) return;
    run.waiters.delete(approvalId);
    run.snap.approvals = run.snap.approvals.filter((a) => a.id !== approvalId);
    if (!this.isFinished(run.snap) && run.snap.approvals.length === 0) run.snap.status = 'working';
    this.emitEvent({ type: 'run.approval.resolved', runId: run.snap.id, approvalId, decision });
    waiter(decision);
  }

  async cancel(runId: string) {
    const run = this.runs.get(runId);
    if (!run) throw new RunError(404, 'run_gone', 'no such run');
    if (this.isFinished(run.snap) || run.cancelRequested) return;
    run.cancelRequested = true;
    for (const id of [...run.waiters.keys()]) this.settleApproval(run, id, 'deny');
    this.emitEvent({ type: 'run.progress', runId, text: 'stopping...' });
    run.snap.progress.push('stopping...');
    const grace = setTimeout(() => this.finish(run, { status: 'cancelled' }), CANCEL_GRACE_MS);
    try {
      await run.handle?.cancel();
    } catch {}
    run.handle?.done.finally(() => clearTimeout(grace));
  }

  private finish(run: ActiveRun, outcome: TurnOutcome) {
    const snap = run.snap;
    if (this.isFinished(snap)) return;
    for (const id of [...run.waiters.keys()]) this.settleApproval(run, id, 'deny');
    if (run.cancelRequested && outcome.status !== 'error') outcome = { status: 'cancelled' };
    if (outcome.status === 'done' && !snap.reply.trim() && outcome.finalText) snap.reply = outcome.finalText;
    snap.status = outcome.status;
    if (outcome.status === 'error') snap.error = outcome.error;
    snap.finishedAt = Date.now();
    snap.approvals = [];
    if (this.locks.get(snap.projectId) === snap.id) this.locks.delete(snap.projectId);
    const key = `${snap.projectId}::${snap.agent}`;
    const prev = this.lastByKey.get(key);
    this.lastByKey.set(key, snap.id);
    if (prev && prev !== snap.id && ![...this.requests.values()].some((r) => r.runId === prev)) this.runs.delete(prev);

    const ts = snap.finishedAt;
    if (snap.reply.trim()) this.store.push(snap.projectId, snap.agent, { role: 'assistant', text: snap.reply.trim(), ts, runId: snap.id });
    if (outcome.status === 'error') this.store.push(snap.projectId, snap.agent, { role: 'notice', text: `error. ${outcome.error}`, ts, runId: snap.id });
    if (outcome.status === 'cancelled') this.store.push(snap.projectId, snap.agent, { role: 'notice', text: 'run stopped', ts, runId: snap.id });
    this.emitEvent({ type: 'run.finished', run: { ...snap } });
  }

  resetSession(projectId: string, agent: AgentId) {
    if (!this.projects.has(projectId)) throw new RunError(404, 'unknown_project', 'unknown project');
    const active = this.activeRunFor(projectId);
    if (active && active.agent === agent) throw new RunError(409, 'project_busy', 'stop the current run before starting a new session');
    this.store.reset(projectId, agent);
    const key = `${projectId}::${agent}`;
    this.lastByKey.delete(key);
    this.emitEvent({ type: 'session.reset', projectId, agent });
  }

  /** Cancel everything, used on shutdown. */
  async shutdown() {
    await Promise.all([...this.locks.values()].map((id) => this.cancel(id).catch(() => {})));
  }
}

export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
