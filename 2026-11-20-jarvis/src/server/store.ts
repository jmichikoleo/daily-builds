import fs from 'node:fs';
import path from 'node:path';
import type { AgentId } from './agents/types.ts';

export interface HistoryEntry {
  role: 'user' | 'assistant' | 'notice';
  text: string;
  ts: number;
  runId?: string;
}

/** One conversation per (project, agent). Only sessions Jarvis started live here. */
export interface SessionRecord {
  sessionId?: string;
  history: HistoryEntry[];
}

interface StateFile {
  version: 1;
  sessions: Record<string, SessionRecord>;
}

const MAX_HISTORY = 60;

export const sessionKey = (projectId: string, agent: AgentId) => `${projectId}::${agent}`;

export class Store {
  private file: string;
  private state: StateFile;
  private timer: NodeJS.Timeout | undefined;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = path.join(dataDir, 'state.json');
    this.state = { version: 1, sessions: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (parsed?.version === 1 && parsed.sessions) this.state = parsed;
    } catch {}
  }

  get(projectId: string, agent: AgentId): SessionRecord {
    const k = sessionKey(projectId, agent);
    return (this.state.sessions[k] ??= { history: [] });
  }

  all(): Record<string, SessionRecord> {
    return this.state.sessions;
  }

  setSessionId(projectId: string, agent: AgentId, id: string) {
    this.get(projectId, agent).sessionId = id;
    this.save();
  }

  push(projectId: string, agent: AgentId, entry: HistoryEntry) {
    const rec = this.get(projectId, agent);
    rec.history.push({ ...entry, text: entry.text.slice(0, 20_000) });
    if (rec.history.length > MAX_HISTORY) rec.history.splice(0, rec.history.length - MAX_HISTORY);
    this.save();
  }

  reset(projectId: string, agent: AgentId) {
    this.state.sessions[sessionKey(projectId, agent)] = { history: [] };
    this.save();
  }

  /** Debounced atomic write. */
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 1), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[jarvis] could not save state:', (err as Error).message);
    }
  }
}
