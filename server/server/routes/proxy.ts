import { Router } from 'express'
import type { RulesDb } from '../db/rulesDb'
import { findMatchingRule } from '../services/matcher'
import { forwardRequest } from '../services/forwarder'
import type { RequestLogEvent } from '../types'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isValidJson(text: string): boolean {
  if (!text.trim()) return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function normalizeRuleHeaders(headers: { key: string; value: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers) {
    const k = String(h.key ?? '').trim()
    if (!k) continue
    out[k] = String(h.value ?? '')
  }
  return out
}

function normalizeTargetBaseUrl(raw: string): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : `http://${s}`
  try {
    const u = new URL(withProtocol)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

export function createProxyRouter(opts: {
  db: RulesDb
  emitLog: (ev: RequestLogEvent) => void
}) {
  const { db, emitLog } = opts
  const router = Router()

  // Express 5 path matching is stricter; use a RegExp catch-all for /api.
  router.all(/^\/api(?:\/.*)?$/, async (req, res) => {
    const method = req.method.toUpperCase()
    const url = req.originalUrl

    const rules = db.getAllRules()
    const match = findMatchingRule(method, url, rules)

    if (match) {
      const ts = new Date().toISOString()
      db.updateRule({ ...match, lastHitAt: ts, updatedAt: match.updatedAt })

      const delay = Number.isFinite(match.delayMs) ? Math.max(0, match.delayMs) : 0
      if (delay > 0) await sleep(delay)

      const headers = normalizeRuleHeaders(match.headers)
      if (isValidJson(match.body)) {
        const hasCt = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
        if (!hasCt) headers['Content-Type'] = 'application/json'
      }

      emitLog({
        id: createId(),
        timestamp: ts,
        method,
        url,
        intercepted: true,
        matchedRuleId: match.id,
        matchedRuleName: match.name,
        status: match.status,
      })

      res.status(match.status)
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
      res.send(match.body ?? '')
      return
    }

    const base = normalizeTargetBaseUrl(db.getTargetBaseUrl())
    if (!base) {
      const ts = new Date().toISOString()
      emitLog({
        id: createId(),
        timestamp: ts,
        method,
        url,
        intercepted: false,
        status: 502,
      })
      res.status(502).json({ error: 'No valid targetBaseUrl configured.' })
      return
    }

    let targetUrl: string
    try {
      targetUrl = new URL(req.originalUrl, `${base}/`).toString()
    } catch {
      const ts = new Date().toISOString()
      emitLog({
        id: createId(),
        timestamp: ts,
        method,
        url,
        intercepted: false,
        status: 502,
      })
      res.status(502).json({ error: 'Invalid targetBaseUrl.' })
      return
    }

    const bodyBuffer =
      method === 'GET' || method === 'HEAD' ? undefined : (req as any).bodyBuffer ?? undefined

    const ts = new Date().toISOString()
    try {
      const fwd = await forwardRequest({
        targetUrl,
        method,
        headers: req.headers,
        bodyBuffer,
      })

      emitLog({
        id: createId(),
        timestamp: ts,
        method,
        url,
        intercepted: false,
        status: fwd.status,
        forwardedTo: targetUrl,
      })

      res.status(fwd.status)
      fwd.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })

      if (!fwd.body) {
        res.end()
        return
      }

      const reader = fwd.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(Buffer.from(value))
      }
      res.end()
    } catch (e) {
      emitLog({
        id: createId(),
        timestamp: ts,
        method,
        url,
        intercepted: false,
        status: 502,
        forwardedTo: targetUrl,
      })
      res.status(502).json({ error: 'Upstream request failed.' })
    }
  })

  return router
}

