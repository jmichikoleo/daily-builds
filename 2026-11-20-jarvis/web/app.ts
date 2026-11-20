import { Recorder, RecorderError } from './recorder.ts';

type AgentId = 'claude' | 'codex' | 'mock';
type RunStatus = 'working' | 'approval' | 'done' | 'error' | 'cancelled';

interface Approval { id: string; runId: string; kind: string; title: string; detail?: string }
interface Run {
  id: string; projectId: string; agent: AgentId; prompt: string; status: RunStatus; reply: string;
  progress: string[]; notices: { level: 'info' | 'warn'; text: string }[]; approvals: Approval[];
  error?: string; startedAt: number; finishedAt?: number; resumed: boolean;
}
interface HistoryEntry { role: 'user' | 'assistant' | 'notice'; text: string; ts: number; runId?: string }
interface Config {
  user: string;
  projects: { id: string; name: string }[];
  agents: { id: AgentId; label: string; available: boolean; version?: string; reason?: string }[];
  defaultAgent: AgentId;
  transcription: { available: boolean; describe: string };
}
type Phase = 'idle' | 'recording' | 'transcribing' | 'submitting';
type View = 'ready' | 'listening' | 'transcribing' | 'working' | 'approval' | 'reply' | 'error' | 'offline';

const SHORT: Record<AgentId, string> = { claude: 'CC', codex: 'CX', mock: 'MK' };
const LABEL: Record<View, string> = {
  ready: 'ready', listening: 'listening', transcribing: 'transcribing', working: 'working',
  approval: 'approve?', reply: 'reply ready', error: 'error', offline: 'offline',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  console: $('console'), project: $<HTMLSelectElement>('project'), agents: $('agents'), link: $('link'),
  expand: $<HTMLButtonElement>('expand'), ring: $<HTMLButtonElement>('ring'), label: $('ring-label'), status: $('status'),
  approvalMini: $('approval-mini'), approvalTitle: $('approval-title'), preview: $('reply-preview'),
  detail: $('detail'), sessionLabel: $('session-label'), stop: $<HTMLButtonElement>('stop'), newSession: $<HTMLButtonElement>('new-session'),
  log: $('log'), composer: $<HTMLFormElement>('composer'), prompt: $<HTMLTextAreaElement>('prompt'), review: $<HTMLInputElement>('review'), send: $<HTMLButtonElement>('send'),
};

// ---------- state ----------
let cfg: Config | undefined;
let baseSeq = 0;
const runs = new Map<string, Run>();
let sessions: Record<string, { sessionId?: string; history: HistoryEntry[] }> = {};
let sel = { projectId: '', agent: 'claude' as AgentId };
let phase: Phase = 'idle';
let localError: string | undefined;
let notice: string | undefined;
const acked = new Set<string>();
let expanded = false;
let linkState: 'up' | 'down' | 'connecting' = 'connecting';
let es: EventSource | undefined;
const recorder = new Recorder();
let recStart = 0;
let recTimer = 0;

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(`jarvis.${k}`);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(`jarvis.${k}`, JSON.stringify(v));
    } catch {}
  },
};

const key = (p = sel.projectId, a = sel.agent) => `${p}::${a}`;
const agentInfo = (id: AgentId) => cfg?.agents.find((a) => a.id === id);
const agentLabel = (id: AgentId) => agentInfo(id)?.label ?? id;
const projectName = (id: string) => cfg?.projects.find((p) => p.id === id)?.name ?? id;

function activeRunInProject(projectId = sel.projectId): Run | undefined {
  for (const r of runs.values()) if (r.projectId === projectId && (r.status === 'working' || r.status === 'approval')) return r;
  return undefined;
}
function lastRun(): Run | undefined {
  let best: Run | undefined;
  for (const r of runs.values()) if (r.projectId === sel.projectId && r.agent === sel.agent && (!best || r.startedAt > best.startedAt)) best = r;
  return best;
}

// ---------- api ----------
class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Jarvis': '1' };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, body, headers: { ...headers, ...(init.headers as Record<string, string>) }, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'http', data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

async function loadState() {
  const s = await api<{ seq: number; runs: Run[]; sessions: typeof sessions }>('/api/state');
  baseSeq = s.seq;
  runs.clear();
  for (const r of s.runs) runs.set(r.id, r);
  sessions = s.sessions;
  render();
}

function connectEvents() {
  es?.close();
  linkState = 'connecting';
  render();
  es = new EventSource(`/api/events?since=${baseSeq}`);
  let wasDown = false;
  es.onopen = () => {
    linkState = 'up';
    // After a drop, refresh the snapshot so run status is current. Nothing is resent.
    if (wasDown) loadState().catch(() => {});
    wasDown = false;
    render();
  };
  es.onerror = () => {
    wasDown = true;
    linkState = es?.readyState === EventSource.CLOSED ? 'down' : 'connecting';
    render();
    if (es?.readyState === EventSource.CLOSED) setTimeout(() => boot(true), 3000);
  };
  es.onmessage = (m) => {
    const seq = Number(m.lastEventId);
    const ev = JSON.parse(m.data);
    if (ev.type === 'resync') return void loadState().catch(() => {});
    if (seq && seq <= baseSeq) return;
    if (seq) baseSeq = seq;
    apply(ev);
  };
}

function apply(ev: any) {
  const r = ev.runId ? runs.get(ev.runId) : undefined;
  switch (ev.type) {
    case 'run.started': {
      runs.set(ev.run.id, ev.run);
      const k = key(ev.run.projectId, ev.run.agent);
      (sessions[k] ??= { history: [] }).history.push({ role: 'user', text: ev.run.prompt, ts: ev.run.startedAt, runId: ev.run.id });
      for (const [id, old] of runs) if (id !== ev.run.id && old.projectId === ev.run.projectId && old.agent === ev.run.agent && old.finishedAt) runs.delete(id);
      break;
    }
    case 'run.delta':
      if (r) r.reply += ev.text;
      break;
    case 'run.progress':
      if (r) r.progress.push(ev.text);
      break;
    case 'run.notice':
      if (r) r.notices.push({ level: ev.level, text: ev.text });
      break;
    case 'run.approval':
      if (r) {
        r.approvals.push(ev.approval);
        r.status = 'approval';
      }
      break;
    case 'run.approval.resolved':
      if (r) {
        r.approvals = r.approvals.filter((a) => a.id !== ev.approvalId);
        if (r.status === 'approval' && !r.approvals.length) r.status = 'working';
      }
      break;
    case 'run.finished': {
      runs.set(ev.run.id, ev.run);
      loadState().catch(() => {}); // pick up the stored history entries and session id
      break;
    }
    case 'session.reset':
      sessions[key(ev.projectId, ev.agent)] = { history: [] };
      for (const [id, old] of runs) if (old.projectId === ev.projectId && old.agent === ev.agent && old.finishedAt) runs.delete(id);
      break;
  }
  scheduleRender();
}

// ---------- actions ----------
function fail(msg: string) {
  localError = msg;
  notice = undefined;
  render();
}
function clearMessages() {
  localError = undefined;
  notice = undefined;
  const last = lastRun();
  if (last?.finishedAt) acked.add(last.id);
}

async function startRecording() {
  clearMessages();
  const busy = activeRunInProject();
  if (busy) return fail(`${agentLabel(busy.agent)} is still working in ${projectName(busy.projectId)}`);
  try {
    phase = 'recording';
    recStart = Date.now();
    render();
    await recorder.start();
    recTimer = window.setInterval(render, 500);
  } catch (err) {
    phase = 'idle';
    const msg = err instanceof Error ? err.message : String(err);
    fail(msg);
    if (err instanceof RecorderError && (err.code === 'unsupported' || err.code === 'mic_denied' || err.code === 'mic_missing')) openComposer();
  }
  render();
}

async function stopRecording(send = true) {
  clearInterval(recTimer);
  if (!send) {
    recorder.cancel();
    phase = 'idle';
    notice = 'recording thrown away';
    return render();
  }
  let rec;
  try {
    rec = await recorder.stop();
  } catch (err) {
    phase = 'idle';
    return fail(err instanceof Error ? err.message : String(err));
  }
  phase = 'transcribing';
  render();
  let text: string;
  try {
    const res = await api<{ text: string }>('/api/transcribe', { method: 'POST', body: rec.wav, headers: { 'Content-Type': 'audio/wav' } });
    text = res.text.trim();
  } catch (err) {
    phase = 'idle';
    const e = err as ApiError;
    fail(e.message);
    if (e.code === 'transcription_unavailable') openComposer();
    return;
  }
  phase = 'idle';
  if (!text) return fail("i didn't catch any words");
  if (el.review.checked) {
    el.prompt.value = text;
    openComposer();
    notice = 'check the transcript, then send';
    return render();
  }
  await submit(text);
}

async function submit(prompt: string) {
  prompt = prompt.trim();
  if (!prompt) return fail('say or type something first');
  if (phase === 'submitting') return;
  clearMessages();
  phase = 'submitting';
  render();
  const clientRequestId = crypto.randomUUID();
  const body = { projectId: sel.projectId, agent: sel.agent, prompt, clientRequestId };
  for (let attempt = 0; ; attempt++) {
    try {
      const { run } = await api<{ run: Run }>('/api/runs', { method: 'POST', json: body });
      if (!runs.has(run.id)) apply({ type: 'run.started', run });
      el.prompt.value = '';
      break;
    } catch (err) {
      // Retry network drops with the same request id; the bridge dedupes, so this never double-submits.
      if (err instanceof TypeError && attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      phase = 'idle';
      if (el.prompt.value.trim() === '') el.prompt.value = prompt; // keep the words so nothing is lost
      return fail((err as Error).message);
    }
  }
  phase = 'idle';
  render();
}

async function decide(approvalId: string, decision: 'allow' | 'deny') {
  try {
    await api(`/api/approvals/${approvalId}`, { method: 'POST', json: { decision } });
  } catch (err) {
    fail((err as Error).message);
  }
}

async function stopRun() {
  const r = activeRunInProject();
  if (!r) return;
  try {
    await api(`/api/runs/${r.id}/cancel`, { method: 'POST', json: {} });
  } catch (err) {
    fail((err as Error).message);
  }
}

async function newSession() {
  try {
    await api('/api/sessions/reset', { method: 'POST', json: { projectId: sel.projectId, agent: sel.agent } });
    clearMessages();
    notice = `new ${agentLabel(sel.agent)} session. the next prompt starts fresh`;
    render();
  } catch (err) {
    fail((err as Error).message);
  }
}

function onRing() {
  const v = view();
  if (phase === 'recording') return void stopRecording(true);
  if (phase !== 'idle') return;
  if (v === 'working' || v === 'approval') return setExpanded(true);
  void startRecording();
}

// When installed as an app, the window itself shrinks to the console and grows for the transcript.
const isApp = () => ['standalone', 'minimal-ui', 'window-controls-overlay'].some((m) => matchMedia(`(display-mode: ${m})`).matches);
function fitWindow() {
  if (!isApp()) return;
  const dw = Math.max(0, window.outerWidth - window.innerWidth);
  const dh = Math.max(0, window.outerHeight - window.innerHeight);
  const [w, h] = expanded ? [Math.max(420, window.innerWidth), Math.max(640, window.innerHeight)] : [240, 160];
  try {
    window.resizeTo(w + dw, h + dh);
  } catch {}
}

function setExpanded(on: boolean) {
  expanded = on;
  store.set('expanded', on);
  render();
  fitWindow();
  if (on) el.log.scrollTop = el.log.scrollHeight;
}
function openComposer() {
  setExpanded(true);
  setTimeout(() => el.prompt.focus(), 0);
}

function select(projectId: string, agent: AgentId) {
  if (phase === 'recording') recorder.cancel();
  phase = phase === 'recording' ? 'idle' : phase;
  sel = { projectId, agent };
  store.set('sel', sel);
  localError = undefined;
  notice = undefined;
  render();
}

// ---------- rendering ----------
function view(): View {
  if (phase === 'recording') return 'listening';
  if (phase === 'transcribing') return 'transcribing';
  if (phase === 'submitting') return 'working';
  const active = activeRunInProject();
  if (active && active.agent === sel.agent) return active.status === 'approval' ? 'approval' : 'working';
  if (localError) return 'error';
  if (linkState === 'down' && !cfg) return 'offline';
  if (active) return 'working';
  const last = lastRun();
  if (last && last.finishedAt && !acked.has(last.id)) {
    if (last.status === 'done') return 'reply';
    if (last.status === 'error') return 'error';
  }
  return 'ready';
}

function tail(text: string, n = 180) {
  const t = text.trim();
  const paras = t.split(/\n{2,}/);
  const last = paras[paras.length - 1] ?? '';
  const pick = last.length > 40 || paras.length === 1 ? last : t;
  return pick.length > n ? '...' + pick.slice(-n) : pick;
}

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  const v = view();
  el.console.dataset.state = v;
  el.console.dataset.expanded = String(expanded);
  el.detail.hidden = !expanded;
  el.expand.setAttribute('aria-expanded', String(expanded));
  el.expand.title = expanded ? 'collapse (e)' : 'expand transcript (e)';
  el.link.dataset.state = linkState;
  el.link.title = linkState === 'up' ? 'connected to the bridge' : linkState === 'connecting' ? 'reconnecting to the bridge...' : 'bridge unreachable';
  el.label.textContent = LABEL[v];

  const active = activeRunInProject();
  const mine = active && active.agent === sel.agent ? active : undefined;
  const last = lastRun();
  const run = mine ?? last;

  // status line beside the ring
  let status = '';
  switch (v) {
    case 'listening': {
      const s = Math.floor((Date.now() - recStart) / 1000);
      status = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} click to send, esc to cancel`;
      break;
    }
    case 'transcribing': status = 'turning speech into text...'; break;
    case 'working':
      status = active && active.agent !== sel.agent ? `${agentLabel(active.agent)} is busy in this project` : run?.progress.at(-1) ?? (phase === 'submitting' ? 'sending...' : 'working...');
      break;
    case 'approval': status = `${run?.approvals.length ?? 0} waiting on you`; break;
    case 'reply': status = 'click the ring to follow up'; break;
    case 'error': status = localError ?? run?.error ?? 'something went wrong'; break;
    case 'offline': status = 'bridge unreachable'; break;
    default: {
      const s = sessions[key()];
      status = notice ?? (s?.sessionId ? `continuing session ${s.sessionId}` : 'new session. click and speak');
    }
  }
  el.status.textContent = status;
  el.ring.setAttribute('aria-label', v === 'listening' ? 'stop recording and send' : v === 'working' || v === 'approval' ? 'show progress' : 'start talking');
  el.ring.disabled = phase === 'transcribing' || phase === 'submitting';

  // collapsed approval + preview
  const pending = mine?.approvals[0];
  el.approvalMini.hidden = !pending;
  if (pending) {
    el.approvalTitle.textContent = (mine!.approvals.length > 1 ? `(${mine!.approvals.length}) ` : '') + pending.title;
    el.approvalTitle.title = pending.detail ?? pending.title;
    el.approvalMini.dataset.id = pending.id;
  }
  let preview = '';
  let muted = false;
  if (v === 'error') preview = localError ?? run?.error ?? '';
  else if (mine) {
    const warn = mine.notices.filter((n) => n.level === 'warn').at(-1);
    preview = warn ? `! ${warn.text}` : mine.reply ? tail(mine.reply) : `“${mine.prompt}”`;
    muted = !mine.reply && !warn;
  } else if (last?.reply) {
    preview = tail(last.reply);
    muted = v !== 'reply';
  } else if (last?.status === 'cancelled') {
    preview = 'stopped';
    muted = true;
  } else if (sessions[key()]?.history.some((h) => h.role === 'assistant')) {
    preview = tail(sessions[key()]!.history.filter((h) => h.role === 'assistant').at(-1)!.text);
    muted = true;
  } else {
    preview = cfg && !cfg.transcription.available ? 'voice is off on the bridge. expand to type' : '';
    muted = true;
  }
  el.preview.textContent = preview;
  el.preview.classList.toggle('muted', muted);

  // agent chips
  for (const b of el.agents.querySelectorAll<HTMLButtonElement>('button')) {
    const on = b.dataset.agent === sel.agent;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  if (el.project.value !== sel.projectId) el.project.value = sel.projectId;

  if (expanded) renderDetail(mine, last);
  else el.stop.disabled = !mine;
}

function renderDetail(mine: Run | undefined, last: Run | undefined) {
  const s = sessions[key()];
  el.sessionLabel.textContent = `${agentLabel(sel.agent)}, ${s?.sessionId ? `session ${s.sessionId}` : 'new session'}`;
  el.stop.disabled = !mine;
  el.newSession.disabled = !!mine;
  el.send.disabled = phase !== 'idle' || !!activeRunInProject();

  const nearBottom = el.log.scrollHeight - el.log.scrollTop - el.log.clientHeight < 40;
  const frag = document.createDocumentFragment();
  const li = (cls: string, who: string | null, text: string) => {
    const item = document.createElement('li');
    item.className = cls;
    if (who) {
      const w = document.createElement('span');
      w.className = 'who';
      w.textContent = who;
      item.append(w);
    }
    item.append(document.createTextNode(text));
    frag.append(item);
    return item;
  };
  const history = s?.history ?? [];
  const liveId = mine?.id;
  for (const h of history) {
    if (liveId && h.runId === liveId) {
      li('user', 'you', h.text);
      continue;
    }
    if (h.role === 'user') li('user', 'you', h.text);
    else if (h.role === 'assistant') li('assistant', agentLabel(sel.agent).toLowerCase(), h.text);
    else li(h.text.startsWith('error') ? 'error' : 'notice', null, h.text);
  }
  const live = mine ?? (last && !last.finishedAt ? last : undefined);
  if (live) {
    if (!history.some((h) => h.runId === live.id)) li('user', 'you', live.prompt);
    for (const p of live.progress.slice(-6)) li('progress', null, `› ${p}`);
    for (const n of live.notices) li(`notice ${n.level}`, null, n.level === 'warn' ? `! ${n.text}` : n.text);
    for (const a of live.approvals) {
      const item = li('approval', 'approval needed', a.title);
      if (a.detail) {
        const pre = document.createElement('pre');
        pre.textContent = a.detail;
        item.append(pre);
      }
      const actions = document.createElement('span');
      actions.className = 'approval-actions';
      actions.dataset.id = a.id;
      actions.innerHTML = '<button type="button" class="btn allow" data-decision="allow">allow</button><button type="button" class="btn deny" data-decision="deny">deny</button>';
      item.append(actions);
    }
    if (live.reply) li('assistant live', agentLabel(live.agent).toLowerCase(), live.reply.trim());
    else li('progress live', null, '');
  } else if (last?.finishedAt) {
    for (const n of last.notices.filter((n) => n.level === 'warn')) li('notice warn', null, `! ${n.text}`);
  }
  if (localError) li('error', null, localError);
  el.log.replaceChildren(frag);
  if (nearBottom || live) el.log.scrollTop = el.log.scrollHeight;
}

// ---------- wiring ----------
function buildControls() {
  if (!cfg) return;
  el.project.replaceChildren(...cfg.projects.map((p) => new Option(p.name, p.id)));
  el.agents.replaceChildren(
    ...cfg.agents.map((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.agent = a.id;
      b.textContent = SHORT[a.id];
      b.setAttribute('aria-label', a.label);
      b.title = a.available ? `${a.label}${a.version ? ` (${a.version})` : ''}` : `${a.label} unavailable (${a.reason ?? ''})`;
      b.disabled = !a.available;
      return b;
    }),
  );
}

function pickSelection() {
  if (!cfg) return;
  const saved = store.get<{ projectId?: string; agent?: AgentId }>('sel', {});
  const usable = cfg.agents.filter((a) => a.available).map((a) => a.id);
  const projectId = cfg.projects.some((p) => p.id === saved.projectId) ? saved.projectId! : cfg.projects[0]?.id ?? '';
  const agent = saved.agent && usable.includes(saved.agent) ? saved.agent : usable.includes(cfg.defaultAgent) ? cfg.defaultAgent : usable[0] ?? cfg.defaultAgent;
  sel = { projectId, agent };
}

el.ring.addEventListener('click', onRing);
el.expand.addEventListener('click', () => setExpanded(!expanded));
el.project.addEventListener('change', () => select(el.project.value, sel.agent));
el.agents.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b?.dataset.agent && !b.disabled) select(sel.projectId, b.dataset.agent as AgentId);
});
el.agents.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const opts = [...el.agents.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const i = opts.findIndex((b) => b.dataset.agent === sel.agent);
  const next = opts[(i + (e.key === 'ArrowRight' ? 1 : opts.length - 1)) % opts.length];
  if (next) {
    select(sel.projectId, next.dataset.agent as AgentId);
    next.focus();
  }
  e.preventDefault();
});
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-decision]');
  if (!b) return;
  const id = b.closest<HTMLElement>('[data-id]')?.dataset.id;
  if (id) {
    b.disabled = true;
    void decide(id, b.dataset.decision as 'allow' | 'deny');
  }
});
el.stop.addEventListener('click', () => void stopRun());
el.newSession.addEventListener('click', () => void newSession());
el.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  void submit(el.prompt.value);
});
el.prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    void submit(el.prompt.value);
  }
});
el.review.addEventListener('change', () => store.set('review', el.review.checked));
document.addEventListener('keydown', (e) => {
  const typing = (e.target as HTMLElement).closest('textarea, input, select');
  if (e.key === 'Escape') {
    if (phase === 'recording') return void stopRecording(false);
    if (expanded && !typing) return setExpanded(false);
  }
  if (!typing && (e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey && !e.altKey) setExpanded(!expanded);
});
recorder.onLevel = (lvl) => el.console.style.setProperty('--lvl', lvl.toFixed(3));
recorder.onLimit = () => void stopRecording(true);

async function boot(retry = false) {
  try {
    cfg = await api<Config>('/api/config');
    buildControls();
    pickSelection();
    await loadState();
    if (retry) localError = undefined;
    connectEvents();
  } catch (err) {
    linkState = 'down';
    if (err instanceof ApiError && err.status === 401) fail('not signed in. open jarvis through your tailscale url, or /auth?token=... in token mode');
    else if (!retry || !cfg) fail(`can't reach the bridge (${(err as Error).message})`);
    setTimeout(() => boot(true), 4000);
  }
  render();
}

el.review.checked = store.get('review', false);
expanded = store.get('expanded', false);
render();
fitWindow();
void boot();
