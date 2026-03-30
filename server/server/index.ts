import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createRulesDb } from './db/rulesDb'
import { createRulesRouter } from './routes/rules'
import { createProxyRouter } from './routes/proxy'
import type { RequestLogEvent } from './types'

const PORT = 3001

/** Local dev fronts (Vite, Angular, etc.) — extend via CORS_ORIGINS=comma,separated */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
]

function corsOrigins(): string[] {
  const extra = process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  return [...new Set([...DEFAULT_CORS_ORIGINS, ...extra])]
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function safeJsonSend(ws: any, obj: unknown) {
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    // ignore
  }
}

async function main() {
  const app = express()
  const server = http.createServer(app)

  const db = createRulesDb()

  // Reflect request origin so Vite on LAN (e.g. http://192.168.x.x:5173) works without CORS_ORIGINS.
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        if (corsOrigins().includes(origin)) return cb(null, true)
        try {
          const u = new URL(origin)
          const port = u.port || (u.protocol === 'https:' ? '443' : '80')
          if (['5173', '4173', '4200'].includes(port)) return cb(null, true)
        } catch {
          /* ignore */
        }
        cb(null, false)
      },
      credentials: false,
    }),
  )

  // Capture raw body for proxy forwarding (all content-types).
  app.use((req, _res, next) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => {
      ;(req as any).bodyBuffer = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)
      next()
    })
    req.on('error', next)
  })

  // Parse JSON for our CRUD endpoints (proxy uses bodyBuffer).
  app.use(express.json({ limit: '5mb' }))

  const wss = new WebSocketServer({ server, path: '/ws' })

  const clients = new Set<any>()
  wss.on('connection', (ws) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    safeJsonSend(ws, { type: 'hello', id: createId() })
  })

  const emitLog = (ev: RequestLogEvent) => {
    const msg = { type: 'log', event: ev }
    for (const ws of clients) safeJsonSend(ws, msg)
  }

  app.use(createRulesRouter(db))
  app.use(createProxyRouter({ db, emitLog }))

  const HOST = '0.0.0.0'
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy server listening on http://127.0.0.1:${PORT} (all interfaces: port ${PORT})`)
    // eslint-disable-next-line no-console
    console.log(`WebSocket log stream on ws://127.0.0.1:${PORT}/ws`)
  })
}

void main()

