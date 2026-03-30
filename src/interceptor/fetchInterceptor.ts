import type { MockRule, RequestLogEntry } from '../types'
import { findFirstMatchingRule } from './matcher'

export type FetchInterceptorDeps = {
  getRules: () => MockRule[]
  onRuleHit?: (ruleId: string, timestampIso: string) => void
  appendLog: (entry: RequestLogEntry) => void
  shouldLogPassthrough?: () => boolean
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function tryParseJson(body: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(body) }
  } catch {
    return { ok: false }
  }
}

function normalizeHeaders(headers: MockRule['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers) {
    const k = h.key.trim()
    if (!k) continue
    out[k] = h.value ?? ''
  }
  return out
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function resolveFetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method
  if (typeof input !== 'string' && !(input instanceof URL) && 'method' in input) {
    return (input as Request).method
  }
  return 'GET'
}

export function initFetchInterceptor(deps: FetchInterceptorDeps) {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveFetchUrl(input)
    const method = resolveFetchMethod(input, init).toUpperCase()
    const rule = findFirstMatchingRule(deps.getRules(), { method, url })

    if (!rule) {
      if (deps.shouldLogPassthrough?.()) {
        deps.appendLog({
          id: createId(),
          timestamp: new Date().toISOString(),
          method,
          url,
          intercepted: false,
        })
      }
      return originalFetch(input as any, init)
    }

    const ts = new Date().toISOString()
    deps.onRuleHit?.(rule.id, ts)

    deps.appendLog({
      id: createId(),
      timestamp: ts,
      method,
      url,
      matchedRuleId: rule.id,
      matchedRuleName: rule.name,
      intercepted: true,
      status: rule.status,
    })

    const delay = Number.isFinite(rule.delayMs) ? Math.max(0, rule.delayMs) : 0
    if (delay > 0) await sleep(delay)

    const headersObj = normalizeHeaders(rule.headers)
    const bodyText = rule.body ?? ''
    const parsed = tryParseJson(bodyText)
    if (parsed.ok) {
      if (!Object.keys(headersObj).some((k) => k.toLowerCase() === 'content-type')) {
        headersObj['Content-Type'] = 'application/json'
      }
    }

    return new Response(bodyText, {
      status: rule.status,
      headers: headersObj,
    })
  }

  return () => {
    window.fetch = originalFetch
  }
}

