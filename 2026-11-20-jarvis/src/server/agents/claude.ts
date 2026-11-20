import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CanUseTool, Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentAdapter, Availability, TurnHandle, TurnInput, TurnOutcome, TurnSink } from './types.ts';

export interface ClaudeOptions {
  executable: string;
  model?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'auto' | 'dontAsk';
}

/** Tools that need an interactive answer Jarvis does not forward in v1. */
const TERMINAL_ONLY_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode']);

export function describeTool(name: string, input: Record<string, unknown>): string {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  switch (name) {
    case 'Bash':
      return `Bash ${s(input.command)}`;
    case 'Edit':
    case 'Write':
    case 'Read':
    case 'NotebookEdit':
      return `${name} ${s(input.file_path) || s(input.notebook_path)}`;
    case 'WebFetch':
      return `WebFetch ${s(input.url)}`;
    case 'WebSearch':
      return `WebSearch ${s(input.query)}`;
    case 'Glob':
    case 'Grep':
      return `${name} ${s(input.pattern)}`;
    default:
      return name;
  }
}

function friendlyError(raw: string): string {
  if (/authentication_failed|invalid api key|please run \/login|not logged in|oauth/i.test(raw))
    return `claude code is not signed in on the mac mini. run claude in a terminal there and use /login (${raw.slice(0, 160)})`;
  if (/ENOENT|spawn .* ENOENT|not found/i.test(raw)) return `could not start claude code (${raw}). check agents.claude.executable in jarvis.config.json`;
  return raw;
}

export function createClaudeAdapter(opts: ClaudeOptions): AgentAdapter {
  return {
    id: 'claude',
    label: 'Claude Code',
    check(): Promise<Availability> {
      return new Promise((resolve) => {
        if (!fs.existsSync(opts.executable)) return resolve({ ok: false, reason: `claude not found at ${opts.executable}` });
        execFile(opts.executable, ['--version'], { timeout: 15_000 }, (err, stdout) => {
          if (err) resolve({ ok: false, reason: `claude --version failed (${err.message})` });
          else resolve({ ok: true, version: stdout.trim() });
        });
      });
    },

    startTurn(input: TurnInput, sink: TurnSink): TurnHandle {
      const abort = new AbortController();
      let cancelled = false;
      let q: Query | undefined;

      const canUseTool: CanUseTool = async (toolName, toolInput, ctx) => {
        if (TERMINAL_ONLY_TOOLS.has(toolName)) {
          sink.notice('warn', `claude wanted ${toolName}, which needs an answer jarvis can't pass along yet. pick this up in a terminal with claude --resume if you need it`);
          return { behavior: 'deny', message: `The user is on the Jarvis voice console, which cannot answer ${toolName}. Proceed without it or tell the user to continue in a terminal.` };
        }
        const title = ctx.title ?? describeTool(toolName, toolInput);
        const detailParts = [ctx.description, ctx.decisionReason ? `reason. ${ctx.decisionReason}` : undefined, ctx.blockedPath ? `path ${ctx.blockedPath}` : undefined];
        if (toolName === 'Edit' && typeof toolInput.old_string === 'string')
          detailParts.push(`- ${String(toolInput.old_string).slice(0, 800)}\n+ ${String(toolInput.new_string ?? '').slice(0, 800)}`);
        else if (toolName !== 'Bash') detailParts.push(JSON.stringify(toolInput, null, 1).slice(0, 1200));
        else detailParts.push(String(toolInput.command ?? ''));
        const decision = await sink.approval({
          kind: toolName === 'Bash' ? 'command' : /Edit|Write/.test(toolName) ? 'file' : 'tool',
          title: describeTool(toolName, toolInput) || title,
          detail: detailParts.filter(Boolean).join('\n'),
        });
        if (decision === 'allow') return { behavior: 'allow', updatedInput: toolInput };
        return { behavior: 'deny', message: 'The user denied this from the Jarvis console.' };
      };

      const run = async (): Promise<TurnOutcome> => {
        let streamedText = false;
        let wroteSomething = false;
        let lastError: string | undefined;
        let stderrTail = '';
        try {
          q = query({
            prompt: input.prompt,
            options: {
              cwd: input.cwd,
              resume: input.sessionId,
              pathToClaudeCodeExecutable: opts.executable,
              // Load the user's own settings, project settings and CLAUDE.md, like a terminal session.
              settingSources: ['user', 'project', 'local'],
              systemPrompt: { type: 'preset', preset: 'claude_code' },
              model: opts.model,
              permissionMode: opts.permissionMode,
              canUseTool,
              includePartialMessages: true,
              abortController: abort,
              env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'jarvis/1.0.0' },
              stderr: (d: string) => {
                stderrTail = (stderrTail + d).slice(-2000);
              },
            },
          });

          for await (const msg of q as AsyncIterable<SDKMessage>) {
            const m = msg as any;
            if (m.session_id) sink.session(m.session_id);
            if (m.type === 'stream_event') {
              const ev = m.event;
              if (m.parent_tool_use_id) continue;
              if (ev?.type === 'message_start' && wroteSomething) sink.delta('\n\n');
              if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                streamedText = true;
                wroteSomething = true;
                sink.delta(ev.delta.text);
              }
            } else if (m.type === 'assistant') {
              if (m.error) lastError = m.error;
              if (m.parent_tool_use_id) continue;
              for (const block of m.message?.content ?? []) {
                if (block.type === 'tool_use') sink.progress(describeTool(block.name, block.input ?? {}));
                else if (block.type === 'text' && !streamedText && block.text) {
                  if (wroteSomething) sink.delta('\n\n');
                  sink.delta(block.text);
                  wroteSomething = true;
                }
              }
              streamedText = false;
            } else if (m.type === 'system' && m.subtype === 'init') {
              sink.progress(`claude code session ...${m.session_id?.slice(-8) ?? ''} ready${m.permissionMode ? ` (${m.permissionMode} mode)` : ''}`);
            } else if (m.type === 'result') {
              if (cancelled) return { status: 'cancelled' };
              for (const d of m.permission_denials ?? []) sink.notice('info', `denied ${describeTool(d.tool_name, d.tool_input ?? {})}`);
              if (m.is_error || m.subtype !== 'success') {
                const raw = [lastError, ...(m.errors ?? []), m.result].filter(Boolean).join(' · ') || m.subtype;
                return { status: 'error', error: friendlyError(raw) };
              }
              return { status: 'done', finalText: m.result };
            }
          }
          if (cancelled) return { status: 'cancelled' };
          return { status: 'error', error: friendlyError(lastError ?? (stderrTail.trim() || 'claude code exited without a result')) };
        } catch (err) {
          if (cancelled) return { status: 'cancelled' };
          const msg = err instanceof Error ? err.message : String(err);
          return { status: 'error', error: friendlyError(`${msg}${stderrTail ? ` · ${stderrTail.trim().slice(-300)}` : ''}`) };
        }
      };

      return {
        done: run(),
        async cancel() {
          cancelled = true;
          try {
            await Promise.race([q?.interrupt(), new Promise((r) => setTimeout(r, 3000))]);
          } catch {}
          abort.abort();
        },
      };
    },
  };
}
