// Entry point: node server/index.ts (Node 22.18+ runs TypeScript directly).
import { createApp } from './app.ts'

const env = process.env
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)
const prod = env.NODE_ENV === 'production'
const port = num(env.PORT, 5341)
const host = env.HOST ?? (prod ? '0.0.0.0' : '127.0.0.1')

const log = (msg: string) => console.log(`[${new Date().toISOString()}] ${msg}`)

const { http, close } = createApp({
  serveClient: prod || env.SERVE_CLIENT === '1',
  corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: env.TRUST_PROXY === '1',
  maxRooms: num(env.MAX_ROOMS, 300),
  idleMs: num(env.ROOM_IDLE_MINUTES, 60) * 60_000,
  maxAgeMs: num(env.ROOM_MAX_AGE_HOURS, 12) * 3_600_000,
  room: {
    reconnectGraceMs: num(env.RECONNECT_GRACE_SECONDS, 90) * 1000,
    hostGraceMs: num(env.HOST_GRACE_SECONDS, 25) * 1000,
  },
  log,
})

http.listen(port, host, () => log(`who said that? listening on http://${host}:${port}${prod ? ' (production)' : ''}`))

for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.on(sig, () => {
    log(`${sig}, shutting down. active rooms are kept in memory only and will be lost.`)
    close().then(() => process.exit(0))
    setTimeout(() => process.exit(0), 3000).unref()
  })
