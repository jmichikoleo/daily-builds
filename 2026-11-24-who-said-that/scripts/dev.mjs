// Runs the socket server (with --watch) and the vite dev server together.
import { spawn } from 'node:child_process'

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT ?? '5341' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', '5340', '--strictPort', '--host', '127.0.0.1'], { stdio: 'inherit' }),
]
const stop = () => procs.forEach((p) => p.kill('SIGTERM'))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
procs.forEach((p) => p.on('exit', (code) => { if (code) { stop(); process.exit(code) } }))
