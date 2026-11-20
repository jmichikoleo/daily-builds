import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AgentId } from './agents/types.ts';

export interface ProjectConfig {
  id: string;
  name: string;
  /** Absolute, real path on the Mac mini. Never comes from the browser. */
  path: string;
}

export interface JarvisConfig {
  port: number;
  host: '127.0.0.1' | '::1';
  dataDir: string;
  auth:
    | { mode: 'tailscale'; allowedLogins: string[] }
    | { mode: 'token'; token: string };
  projects: ProjectConfig[];
  agents: {
    claude: { enabled: boolean; executable: string; model?: string; permissionMode?: 'default' | 'acceptEdits' | 'plan' | 'auto' | 'dontAsk' };
    codex: { enabled: boolean; executable: string; model?: string; approvalPolicy?: 'untrusted' | 'on-request'; sandbox?: 'read-only' | 'workspace-write' };
    mock: { enabled: boolean };
  };
  transcription:
    | { backend: 'whisper-cpp'; command: string; model: string; language: string; threads: number; timeoutMs: number }
    | { backend: 'mock' }
    | { backend: 'none' };
}

export class ConfigError extends Error {}

const ID_RE = /^[a-z0-9][a-z0-9-_]{0,39}$/;

function fail(msg: string): never {
  throw new ConfigError(msg);
}

function str(v: unknown, name: string): string {
  if (typeof v !== 'string' || !v.trim()) fail(`${name} must be a non-empty string`);
  return v.trim();
}

/** Resolve and check a project path. Exported so tests can exercise it. */
export function validateProjectPath(p: string, id: string): string {
  if (!path.isAbsolute(p)) fail(`project "${id}": path must be absolute (got ${p})`);
  let real: string;
  try {
    real = fs.realpathSync(p);
  } catch {
    fail(`project "${id}": path does not exist (${p})`);
  }
  if (!fs.statSync(real).isDirectory()) fail(`project "${id}": path is not a directory (${p})`);
  if (real === '/' || real === os.homedir()) fail(`project "${id}": refusing to use ${real} as a project root`);
  return real;
}

function whichSync(bin: string): string | undefined {
  const dirs = (process.env.PATH ?? '').split(':').concat([
    path.join(os.homedir(), '.local/bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ]);
  for (const d of dirs) {
    const full = path.join(d, bin);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch {}
  }
  return undefined;
}

function executable(v: unknown, fallbackName: string, name: string): string {
  if (v === undefined) return whichSync(fallbackName) ?? fallbackName;
  const s = str(v, name);
  if (!path.isAbsolute(s)) fail(`${name} must be an absolute path`);
  return s;
}

export function parseConfig(raw: any, baseDir: string): JarvisConfig {
  if (!raw || typeof raw !== 'object') fail('config must be a JSON object');

  const port = raw.port ?? 8470;
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail('port must be an integer 1024-65535');
  const host = raw.host ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '::1') fail('host must be loopback (127.0.0.1 or ::1); use Tailscale Serve for remote access');

  const dataDir = path.resolve(baseDir, raw.dataDir ?? 'data');

  const a = raw.auth ?? {};
  let auth: JarvisConfig['auth'];
  if (a.mode === 'token') {
    const token = process.env.JARVIS_TOKEN ?? a.token;
    if (typeof token !== 'string' || token.length < 24) fail('auth.token (or JARVIS_TOKEN) must be at least 24 characters');
    auth = { mode: 'token', token };
  } else if (a.mode === 'tailscale' || a.mode === undefined) {
    const logins = a.allowedLogins;
    if (!Array.isArray(logins) || logins.length === 0 || !logins.every((l: unknown) => typeof l === 'string' && l.includes('@')))
      fail('auth.allowedLogins must list your tailnet login(s), e.g. ["you@github"]');
    auth = { mode: 'tailscale', allowedLogins: logins.map((l: string) => l.toLowerCase()) };
  } else {
    fail('auth.mode must be "tailscale" or "token"');
  }

  if (!Array.isArray(raw.projects) || raw.projects.length === 0) fail('projects must be a non-empty array');
  const seen = new Set<string>();
  const projects: ProjectConfig[] = raw.projects.map((p: any) => {
    const id = str(p?.id, 'project id');
    if (!ID_RE.test(id)) fail(`project id "${id}" must be lowercase letters, digits, - or _`);
    if (seen.has(id)) fail(`duplicate project id "${id}"`);
    seen.add(id);
    return { id, name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 40) : id, path: validateProjectPath(str(p.path, `project "${id}" path`), id) };
  });

  const ag = raw.agents ?? {};
  const claudeMode = ag.claude?.permissionMode;
  if (claudeMode !== undefined && !['default', 'acceptEdits', 'plan', 'auto', 'dontAsk'].includes(claudeMode))
    fail('agents.claude.permissionMode must be default, acceptEdits, plan, auto or dontAsk (bypassPermissions is not allowed)');
  const codexPolicy = ag.codex?.approvalPolicy;
  if (codexPolicy !== undefined && !['untrusted', 'on-request'].includes(codexPolicy))
    fail('agents.codex.approvalPolicy must be untrusted or on-request (leave it out to use your Codex config)');
  const codexSandbox = ag.codex?.sandbox;
  if (codexSandbox !== undefined && !['read-only', 'workspace-write'].includes(codexSandbox))
    fail('agents.codex.sandbox must be read-only or workspace-write (leave it out to use your Codex config)');

  const agents: JarvisConfig['agents'] = {
    claude: {
      enabled: ag.claude?.enabled ?? true,
      executable: executable(ag.claude?.executable, 'claude', 'agents.claude.executable'),
      model: ag.claude?.model,
      permissionMode: claudeMode,
    },
    codex: {
      enabled: ag.codex?.enabled ?? true,
      executable: executable(ag.codex?.executable, 'codex', 'agents.codex.executable'),
      model: ag.codex?.model,
      approvalPolicy: codexPolicy,
      sandbox: codexSandbox,
    },
    mock: { enabled: ag.mock?.enabled ?? false },
  };

  const t = raw.transcription ?? { backend: 'none' };
  let transcription: JarvisConfig['transcription'];
  if (t.backend === 'whisper-cpp') {
    const command = str(t.command, 'transcription.command');
    const model = str(t.model, 'transcription.model');
    if (!path.isAbsolute(command) || !path.isAbsolute(model)) fail('transcription.command and transcription.model must be absolute paths');
    transcription = {
      backend: 'whisper-cpp',
      command,
      model,
      language: typeof t.language === 'string' ? t.language : 'en',
      threads: Number.isInteger(t.threads) ? t.threads : 4,
      timeoutMs: Number.isInteger(t.timeoutMs) ? t.timeoutMs : 60_000,
    };
  } else if (t.backend === 'mock') {
    transcription = { backend: 'mock' };
  } else if (t.backend === 'none' || t.backend === undefined) {
    transcription = { backend: 'none' };
  } else {
    fail('transcription.backend must be whisper-cpp, mock or none');
  }

  return { port, host, dataDir, auth, projects, agents, transcription };
}

export function loadConfig(): JarvisConfig {
  const file = path.resolve(process.env.JARVIS_CONFIG ?? 'jarvis.config.json');
  const mock = process.env.JARVIS_MOCK === '1';
  if (!fs.existsSync(file)) {
    if (!mock) fail(`no config at ${file}. Copy jarvis.config.example.json to jarvis.config.json, or run "npm run mock".`);
    return mockConfig();
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (mock) {
    raw.agents = { ...raw.agents, mock: { enabled: true } };
    raw.transcription ??= { backend: 'mock' };
  }
  const cfg = parseConfig(raw, path.dirname(file));
  if (process.env.JARVIS_PORT) cfg.port = Number(process.env.JARVIS_PORT);
  return cfg;
}

/** A config that needs nothing installed: token auth, two scratch projects, mock agent. */
export function mockConfig(): JarvisConfig {
  // Separate from the real bridge's data/state.json so the two never overwrite each other.
  const dataDir = path.resolve('data', 'mock');
  const dirs = ['demo-app', 'demo-site'].map((d) => {
    const p = path.join(dataDir, 'mock-projects', d);
    fs.mkdirSync(p, { recursive: true });
    return p;
  });
  const token = process.env.JARVIS_TOKEN ?? 'mock-token-for-local-testing-only';
  return parseConfig(
    {
      port: Number(process.env.JARVIS_PORT ?? 8470),
      dataDir,
      auth: { mode: 'token', token },
      projects: [
        { id: 'demo-app', name: 'demo app', path: dirs[0] },
        { id: 'demo-site', name: 'demo site', path: dirs[1] },
      ],
      agents: { claude: { enabled: false }, codex: { enabled: false }, mock: { enabled: true } },
      transcription: { backend: 'mock' },
    },
    process.cwd(),
  );
}

export type { AgentId };
