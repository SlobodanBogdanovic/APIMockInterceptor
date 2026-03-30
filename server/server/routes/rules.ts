import { Router, type Request } from 'express'
import type { RulesDb } from '../db/rulesDb'
import type { MockRule } from '../types'

type RequestWithBuffer = Request & { bodyBuffer?: Buffer }

/**
 * Prefer req.body when express.json populated it; otherwise parse bodyBuffer.
 * Avoids "Invalid rule payload" when req.body is {} or undefined but the raw JSON is still on the request.
 */
function readJsonBody(req: Request): unknown {
  const b = req.body as unknown
  if (b !== null && typeof b === 'object' && !Array.isArray(b) && Object.keys(b as object).length > 0) {
    return b
  }
  const buf = (req as RequestWithBuffer).bodyBuffer
  if (Buffer.isBuffer(buf) && buf.length > 0) {
    try {
      return JSON.parse(buf.toString('utf8'))
    } catch {
      return b
    }
  }
  return b
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeTargetBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: true, url: '' }
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : `http://${s}`
  try {
    const u = new URL(withProtocol)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'Must be http(s).' }
    return { ok: true, url: u.toString().replace(/\/+$/, '') }
  } catch {
    return { ok: false, error: 'Invalid URL.' }
  }
}

function normalizeRuleInput(input: any, existing?: MockRule): MockRule | null {
  const id = typeof input?.id === 'string' && input.id ? input.id : existing?.id ?? createId()
  const createdAt = existing?.createdAt ?? (typeof input?.createdAt === 'string' ? input.createdAt : nowIso())
  const updatedAt = nowIso()

  const method = input?.method
  const methodOk =
    method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH' || method === 'ANY'

  const headers = Array.isArray(input?.headers) ? input.headers : []

  if (typeof input?.urlPattern !== 'string') return null
  const status = Number(input?.status)
  if (!Number.isFinite(status)) return null

  const delayMs = Number(input?.delayMs ?? 0)
  if (!Number.isFinite(delayMs)) return null

  return {
    id,
    name: typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : existing?.name ?? 'New rule',
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : existing?.enabled ?? true,
    method: methodOk ? method : existing?.method ?? 'ANY',
    urlPattern: String(input.urlPattern),
    status: Math.min(599, Math.max(100, Math.trunc(status))),
    delayMs: Math.max(0, Math.trunc(delayMs)),
    headers: headers.map((h: any) => ({
      id: typeof h?.id === 'string' && h.id ? h.id : createId(),
      key: typeof h?.key === 'string' ? h.key : '',
      value: typeof h?.value === 'string' ? h.value : '',
    })),
    body: typeof input?.body === 'string' ? input.body : existing?.body ?? '',
    createdAt,
    updatedAt,
    lastHitAt: typeof input?.lastHitAt === 'string' ? input.lastHitAt : existing?.lastHitAt,
  }
}

export function createRulesRouter(db: RulesDb) {
  const router = Router()

  router.get('/api/rules', (_req, res) => {
    res.json(db.getAllRules())
  })

  router.post('/api/rules', (req, res) => {
    const rule = normalizeRuleInput(readJsonBody(req))
    if (!rule) return res.status(400).json({ error: 'Invalid rule payload.' })
    db.createRule(rule)
    res.status(201).json(rule)
  })

  router.put('/api/rules/:id', (req, res) => {
    const id = req.params.id
    const existing = db.getAllRules().find((r) => r.id === id)
    if (!existing) return res.status(404).json({ error: 'Rule not found.' })
    const patch = readJsonBody(req)
    const merged =
      patch !== null && typeof patch === 'object' && !Array.isArray(patch)
        ? { ...(patch as Record<string, unknown>), id }
        : { id }
    const next = normalizeRuleInput(merged, existing)
    if (!next) return res.status(400).json({ error: 'Invalid rule payload.' })
    const updated = db.updateRule(next)
    if (!updated) return res.status(404).json({ error: 'Rule not found.' })
    res.json(updated)
  })

  router.delete('/api/rules/:id', (req, res) => {
    const ok = db.deleteRule(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Rule not found.' })
    res.status(204).send()
  })

  router.post('/api/rules/import', (req, res) => {
    const obj = readJsonBody(req) as any
    if (!obj || typeof obj !== 'object') return res.status(400).json({ error: 'Invalid JSON root.' })
    if (obj.version !== 1) return res.status(400).json({ error: 'Unsupported export version.' })
    if (!Array.isArray(obj.rules)) return res.status(400).json({ error: 'Invalid export format.' })

    const normalized: MockRule[] = []
    for (const r of obj.rules) {
      const rule = normalizeRuleInput(r)
      if (!rule) return res.status(400).json({ error: 'Invalid rule in import.' })
      normalized.push(rule)
    }
    db.replaceAllRules(normalized)
    res.json({ ok: true, count: normalized.length })
  })

  router.get('/api/config', (_req, res) => {
    res.json({ targetBaseUrl: db.getTargetBaseUrl() })
  })

  router.put('/api/config', (req, res) => {
    const body = readJsonBody(req) as { targetBaseUrl?: string }
    const raw = typeof body?.targetBaseUrl === 'string' ? body.targetBaseUrl : ''
    const normalized = normalizeTargetBaseUrl(raw)
    if (!normalized.ok) return res.status(400).json({ error: normalized.error })
    db.setTargetBaseUrl(normalized.url)
    res.json({ targetBaseUrl: normalized.url })
  })

  return router
}

