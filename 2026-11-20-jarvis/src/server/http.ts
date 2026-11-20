import { createHash, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { AgentAdapter, AgentId, Availability } from './agents/types.ts';
import type { JarvisConfig } from './config.ts';
import { RunError, errorText } from './runs.ts';
import type { RunManager, SeqEvent } from './runs.ts';
import type { Store } from './store.ts';
import { TranscribeError } from './transcribe.ts';
import type { Transcriber } from './transcribe.ts';

export interface AppDeps {
  config: JarvisConfig;
  runs: RunManager;
  store: Store;
  adapters: AgentAdapter[];
  transcriber: Transcriber;
  publicDir: string;
}

const STATIC: Record<string, string> = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/app.js': 'app.js',
  '/style.css': 'style.css',
  '/rec-worklet.js': 'rec-worklet.js',
  '/favicon.svg': 'favicon.svg',
  '/manifest.webmanifest': 'manifest.webmanifest',
  '/icon-192.png': 'icon-192.png',
  '/icon-512.png': 'icon-512.png',
};
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const COOKIE = 'jarvis_auth';
const MAX_JSON = 64 * 1024;
const MAX_AUDIO = 20 * 1024 * 1024;
const MAX_PROMPT = 8000;

const sha = (s: string) => createHash('sha256').update(s).digest();

function securityHeaders(res: ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, code: string, message: string) {
  send(res, status, { error: { code, message } });
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new RunError(413, 'too_large', 'request is too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req: IncomingMessage): Promise<any> {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new RunError(415, 'bad_content_type', 'expected json');
  const buf = await readBody(req, MAX_JSON);
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new RunError(400, 'bad_json', 'malformed json');
  }
}

function parseCookies(h: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (h ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function tokenMatches(given: string | undefined, token: string): boolean {
  if (!given) return false;
  return timingSafeEqual(sha(given), sha(token));
}

export type AuthResult = { ok: true; user: string } | { ok: false };

export function authenticate(req: IncomingMessage, auth: JarvisConfig['auth']): AuthResult {
  if (auth.mode === 'tailscale') {
    // Set by Tailscale Serve for requests from tailnet users; Serve strips any client-sent copy.
    const login = String(req.headers['tailscale-user-login'] ?? '').toLowerCase();
    if (login && auth.allowedLogins.includes(login)) return { ok: true, user: login };
    return { ok: false };
  }
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  const cookie = parseCookies(req.headers.cookie)[COOKIE];
  if (tokenMatches(bearer, auth.token) || (cookie && timingSafeEqual(sha(cookie), sha(sha(auth.token).toString('hex'))))) return { ok: true, user: 'token' };
  return { ok: false };
}

export function createApp(deps: AppDeps) {
  const { config, runs, store, transcriber } = deps;
  const adapters = new Map<AgentId, AgentAdapter>(deps.adapters.map((a) => [a.id, a]));
  const availability = new Map<AgentId, Availability>();
  let checkedAt = 0;

  async function refreshAvailability(force = false) {
    if (!force && Date.now() - checkedAt < 60_000 && availability.size) return;
    checkedAt = Date.now();
    await Promise.all(
      [...adapters.values()].map(async (a) => {
        try {
          availability.set(a.id, await a.check());
        } catch (err) {
          availability.set(a.id, { ok: false, reason: errorText(err) });
        }
      }),
    );
  }

  function agentList() {
    const all: AgentId[] = ['claude', 'codex', 'mock'];
    return all
      .filter((id) => adapters.has(id))
      .map((id) => ({ id, label: adapters.get(id)!.label, available: availability.get(id)?.ok ?? false, version: availability.get(id)?.version, reason: availability.get(id)?.reason }));
  }

  function stateBody() {
    const sessions: Record<string, { sessionId?: string; history: unknown[] }> = {};
    for (const [k, v] of Object.entries(store.all())) sessions[k] = { sessionId: v.sessionId ? v.sessionId.slice(-8) : undefined, history: v.history };
    return { seq: runs.currentSeq(), runs: runs.visibleRuns(), sessions };
  }

  function serveStatic(req: IncomingMessage, res: ServerResponse, file: string) {
    const full = path.join(deps.publicDir, file);
    fs.readFile(full, (err, data) => {
      if (err) return sendError(res, 404, 'not_found', 'not found');
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(data);
    });
  }

  function events(req: IncomingMessage, res: ServerResponse, url: URL) {
    const lastId = Number(req.headers['last-event-id'] ?? url.searchParams.get('since') ?? runs.currentSeq());
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const write = (e: SeqEvent) => res.write(`id: ${e.seq}\ndata: ${JSON.stringify(e.event)}\n\n`);
    res.write('retry: 1500\n\n');
    const backlog = runs.eventsSince(Number.isFinite(lastId) ? lastId : runs.currentSeq());
    if (backlog === null) res.write(`id: ${runs.currentSeq()}\ndata: ${JSON.stringify({ type: 'resync' })}\n\n`);
    else backlog.forEach(write);
    runs.on('event', write);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(ping);
      runs.off('event', write);
    });
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? '/', 'http://jarvis.local');
    const method = req.method ?? 'GET';
    securityHeaders(res);

    // Token pairing: /auth?token=... sets an HttpOnly cookie, then drops the token from the URL.
    if (url.pathname === '/auth' && config.auth.mode === 'token') {
      const token = url.searchParams.get('token') ?? '';
      if (!tokenMatches(token, config.auth.token)) return sendError(res, 401, 'unauthorized', 'wrong token');
      const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `${COOKIE}=${sha(config.auth.token).toString('hex')}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${secure}`);
      res.statusCode = 303;
      res.setHeader('Location', '/');
      return res.end();
    }

    const who = authenticate(req, config.auth);
    if (!who.ok) {
      if (method === 'GET' && !url.pathname.startsWith('/api/')) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end(
          config.auth.mode === 'tailscale'
            ? 'jarvis. not authorized. open it through your tailscale serve url while signed in as an allowed tailnet user'
            : 'jarvis. not authorized. open /auth?token=YOUR_TOKEN once on this device',
        );
      }
      return sendError(res, 401, 'unauthorized', 'not authorized');
    }

    if (method === 'GET' && STATIC[url.pathname]) return serveStatic(req, res, STATIC[url.pathname]);

    if (!url.pathname.startsWith('/api/')) return sendError(res, 404, 'not_found', 'not found');

    // Writes must come from our own page: a custom header forces a CORS preflight we never allow.
    if (method !== 'GET') {
      if (req.headers['x-jarvis'] !== '1') return sendError(res, 403, 'csrf', 'missing x-jarvis header');
      // Defense in depth on top of X-Jarvis. Serve may forward the original host in Host or X-Forwarded-Host.
      const origin = req.headers.origin;
      if (origin) {
        let originHost = '';
        try {
          originHost = new URL(origin).host;
        } catch {}
        const hosts = [req.headers.host, req.headers['x-forwarded-host']].flat().filter(Boolean);
        const tailnet = config.auth.mode === 'tailscale' && origin.startsWith('https://') && /\.ts\.net(:\d+)?$/.test(originHost);
        if (!hosts.includes(originHost) && !tailnet) return sendError(res, 403, 'csrf', 'cross-origin request refused');
      }
    }

    try {
      if (method === 'GET' && url.pathname === '/api/config') {
        await refreshAvailability(url.searchParams.get('refresh') === '1');
        return send(res, 200, {
          user: who.user,
          projects: config.projects.map((p) => ({ id: p.id, name: p.name })),
          agents: agentList(),
          defaultAgent: 'claude',
          transcription: { available: transcriber.available, describe: transcriber.describe },
        });
      }
      if (method === 'GET' && url.pathname === '/api/state') return send(res, 200, stateBody());
      if (method === 'GET' && url.pathname === '/api/events') return events(req, res, url);

      if (method === 'POST' && url.pathname === '/api/runs') {
        const body = await readJson(req);
        const projectId = String(body.projectId ?? '');
        const agent = String(body.agent ?? '') as AgentId;
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
        const clientRequestId = typeof body.clientRequestId === 'string' ? body.clientRequestId.slice(0, 64) : undefined;
        if (!prompt) return sendError(res, 400, 'empty_prompt', 'say or type something first');
        if (prompt.length > MAX_PROMPT) return sendError(res, 400, 'prompt_too_long', `prompts are limited to ${MAX_PROMPT} characters`);
        if (!adapters.has(agent)) return sendError(res, 400, 'agent_unavailable', `${agent || 'that agent'} is not turned on in the bridge`);
        await refreshAvailability();
        const av = availability.get(agent);
        if (!av?.ok) return sendError(res, 503, 'agent_unavailable', av?.reason ?? `${agent} is not available`);
        const run = runs.start(projectId, agent, prompt, clientRequestId);
        return send(res, 202, { run });
      }

      const cancel = /^\/api\/runs\/([0-9a-f-]{36})\/cancel$/.exec(url.pathname);
      if (method === 'POST' && cancel) {
        await runs.cancel(cancel[1]);
        return send(res, 202, { ok: true });
      }

      const appr = /^\/api\/approvals\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (method === 'POST' && appr) {
        const body = await readJson(req);
        if (body.decision !== 'allow' && body.decision !== 'deny') return sendError(res, 400, 'bad_decision', 'decision must be allow or deny');
        runs.resolveApproval(appr[1], body.decision);
        return send(res, 200, { ok: true });
      }

      if (method === 'POST' && url.pathname === '/api/sessions/reset') {
        const body = await readJson(req);
        runs.resetSession(String(body.projectId ?? ''), String(body.agent ?? '') as AgentId);
        return send(res, 200, { ok: true });
      }

      if (method === 'POST' && url.pathname === '/api/transcribe') {
        if (!transcriber.available) throw new TranscribeError(503, 'transcription_unavailable', 'voice is not set up on the bridge yet. type your prompt instead, the readme shows how to turn on whisper.cpp');
        const type = req.headers['content-type'] ?? '';
        if (!/^audio\/(wav|x-wav|wave)/.test(type)) throw new TranscribeError(415, 'unsupported_audio', 'send audio as audio/wav');
        const buf = await readBody(req, MAX_AUDIO);
        const text = await transcriber.transcribe(buf);
        return send(res, 200, { text });
      }

      return sendError(res, 404, 'not_found', 'not found');
    } catch (err) {
      if (err instanceof RunError || err instanceof TranscribeError) return sendError(res, err.status, err.code, err.message);
      console.error('[jarvis]', err);
      return sendError(res, 500, 'internal', errorText(err));
    }
  }

  return {
    handler: (req: IncomingMessage, res: ServerResponse) => {
      route(req, res).catch((err) => {
        console.error('[jarvis]', err);
        if (!res.headersSent) sendError(res, 500, 'internal', 'internal error');
      });
    },
    refreshAvailability,
  };
}
