// Shared contract every agent backend implements.
// A "turn" is one prompt sent to an agent session. Resuming is just starting
// a turn with the sessionId a previous turn reported.

export type AgentId = 'claude' | 'codex' | 'mock';

export type ApprovalKind = 'command' | 'file' | 'tool' | 'network';

export interface ApprovalRequest {
  kind: ApprovalKind;
  /** Short line for the collapsed view, e.g. "Bash: npm test". */
  title: string;
  /** Longer text for the expanded view (command, cwd, reason). */
  detail?: string;
}

export type ApprovalDecision = 'allow' | 'deny';

export interface TurnSink {
  /** The agent's own session/thread id, so later turns can resume it. */
  session(id: string): void;
  /** Reply text, streamed in chunks. */
  delta(text: string): void;
  /** One-line progress such as "Running npm test". */
  progress(text: string): void;
  /** Something the user should know, e.g. an approval Jarvis can't forward. */
  notice(level: 'info' | 'warn', text: string): void;
  /** Ask the person at the console. Resolves to deny if the run is cancelled. */
  approval(req: ApprovalRequest): Promise<ApprovalDecision>;
}

export interface TurnInput {
  cwd: string;
  prompt: string;
  /** Present when continuing a session Jarvis started earlier. */
  sessionId?: string;
}

export type TurnOutcome =
  | { status: 'done'; finalText?: string }
  | { status: 'cancelled' }
  | { status: 'error'; error: string };

export interface TurnHandle {
  cancel(): Promise<void>;
  done: Promise<TurnOutcome>;
}

export interface Availability {
  ok: boolean;
  version?: string;
  reason?: string;
}

export interface AgentAdapter {
  id: AgentId;
  label: string;
  check(): Promise<Availability>;
  startTurn(input: TurnInput, sink: TurnSink): TurnHandle;
}
