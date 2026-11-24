// HTTP + Socket.IO server factory (used by index.ts and the tests).
import { existsSync } from 'node:fs'
import { createServer, type Server as HttpServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { Server } from 'socket.io'
import { RoomManager, type ManagerOptions } from './rooms.ts'
import { attachSockets } from './socket.ts'

export interface AppOptions extends ManagerOptions {
  serveClient?: boolean
  corsOrigins?: string[]
  trustProxy?: boolean
  log?: (msg: string) => void
}

export function createApp(o: AppOptions = {}) {
  const app = express()
  app.disable('x-powered-by')
  if (o.trustProxy) app.set('trust proxy', true)
  const manager = new RoomManager(o)
  const started = Date.now()

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ws: wss:; script-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    )
    next()
  })

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: manager.rooms.size, uptimeSeconds: Math.round((Date.now() - started) / 1000) })
  })

  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
  if (o.serveClient && existsSync(dist)) {
    app.use('/assets', express.static(join(dist, 'assets'), { immutable: true, maxAge: '1y' }))
    app.use(express.static(dist, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!socket\.io|healthz).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(dist, 'index.html'))
    })
  }

  const http: HttpServer = createServer(app)
  const io = new Server(http, {
    cors: o.corsOrigins?.length ? { origin: o.corsOrigins } : undefined,
    maxHttpBufferSize: 256 * 1024,
    pingInterval: 10_000,
    pingTimeout: 12_000,
    connectionStateRecovery: undefined,
  })
  attachSockets(io as never, manager, o.log)
  const sweeper = setInterval(() => {
    const gone = manager.sweep()
    if (gone.length) o.log?.(`swept ${gone.length} room(s)`)
  }, 60_000)
  sweeper.unref()

  return {
    app,
    http,
    io,
    manager,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweeper)
        for (const r of manager.rooms.values()) r.destroy()
        io.close()
        http.close(() => resolve())
      }),
  }
}
