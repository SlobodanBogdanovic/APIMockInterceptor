import http from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createRulesDb } from './db/rulesDb'
import { createRulesRouter } from './routes/rules'
import { createProxyRouter } from './routes/proxy'
import type { RequestLogEvent } from './types'

const PORT = 3001

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

  app.use(
    cors({
      origin: ['http://localhost:5173'],
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

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Proxy server listening on http://localhost:${PORT}`)
    // eslint-disable-next-line no-console
    console.log(`WebSocket log stream on ws://localhost:${PORT}/ws`)
  })
}

void main()

