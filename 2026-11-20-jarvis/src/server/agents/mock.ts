import { randomUUID } from 'node:crypto';
import type { AgentAdapter, TurnHandle, TurnInput, TurnOutcome, TurnSink } from './types.ts';

/**
 * Pretend agent for trying the console with nothing installed.
 * - Prompts mentioning fix/edit/change/approve ask for an approval first.
 * - Prompts mentioning "terminal" emit a can't-forward notice.
 * - Prompts mentioning "fail" end in an error.
 * Replies say which turn of which session they are, so session isolation is visible.
 */
export function createMockAdapter(opts: { stepMs?: number } = {}): AgentAdapter {
  const step = opts.stepMs ?? 220;
  const turns = new Map<string, number>();

  return {
    id: 'mock',
    label: 'Mock',
    async check() {
      return { ok: true, version: 'mock' };
    },
    startTurn(input: TurnInput, sink: TurnSink): TurnHandle {
      let cancelled = false;
      let wake: (() => void) | undefined;
      const sleep = (ms: number) =>
        new Promise<void>((r) => {
          const t = setTimeout(r, ms);
          wake = () => {
            clearTimeout(t);
            r();
          };
        });

      const run = async (): Promise<TurnOutcome> => {
        const sessionId = input.sessionId ?? `mock-${randomUUID().slice(0, 8)}`;
        const n = (turns.get(sessionId) ?? 0) + 1;
        turns.set(sessionId, n);
        sink.session(sessionId);
        sink.progress('reading the project');
        await sleep(step * 2);
        if (cancelled) return { status: 'cancelled' };

        const p = input.prompt.toLowerCase();
        if (p.includes('fail')) return { status: 'error', error: 'mock failure asked for by the prompt' };
        if (p.includes('terminal')) sink.notice('warn', 'mock. this step needs an answer jarvis cannot pass along. run it from a terminal');

        let words: string[];
        if (/\b(fix|edit|change|approve)\b/.test(p)) {
          sink.progress('planning an edit to src/app.ts');
          const decision = await sink.approval({ kind: 'file', title: 'edit src/app.ts', detail: '- return a + b\n+ return a + b + 0 // mock change' });
          if (cancelled) return { status: 'cancelled' };
          if (decision === 'deny') {
            words = 'okay, i left src/app.ts alone. nothing changed'.split(' ');
          } else {
            sink.progress('editing src/app.ts');
            await sleep(step);
            words = `done. i fixed the off-by-one in src/app.ts. this was turn ${n} of session ${sessionId}`.split(' ');
          }
        } else {
          words = `you said "${input.prompt.slice(0, 80)}". this is turn ${n} of session ${sessionId} in ${input.cwd.split('/').pop()}`.split(' ');
        }

        for (const w of words) {
          if (cancelled) return { status: 'cancelled' };
          sink.delta(w + ' ');
          await sleep(step / 3);
        }
        return { status: 'done' };
      };

      return {
        done: run(),
        async cancel() {
          cancelled = true;
          wake?.();
        },
      };
    },
  };
}
