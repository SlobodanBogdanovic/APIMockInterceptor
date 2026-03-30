import type { MockRule, RequestLogEntry } from '../types'
import { findFirstMatchingRule } from './matcher'

export type XhrInterceptorDeps = {
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

function normalizeHeaders(headers: MockRule['headers']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of headers) {
    const k = h.key.trim()
    if (!k) continue
    out[k.toLowerCase()] = h.value ?? ''
  }
  return out
}

function tryParseJson(body: string): boolean {
  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
}

export function initXhrInterceptor(deps: XhrInterceptorDeps) {
  const OriginalXHR = window.XMLHttpRequest

  class InterceptedXHR extends OriginalXHR {
    private _method?: string
    private _url?: string
    private _async = true
    private _requestHeaders: Record<string, string> = {}

    private _isIntercepted = false
    private _mockHeaders: Record<string, string> = {}
    private _mockBody = ''

    override open(
      method: string,
      url: string,
      async: boolean = true,
      username?: string | null,
      password?: string | null,
    ): void {
      this._method = method?.toUpperCase?.() ?? String(method)
      this._url = String(url)
      this._async = async !== false
      super.open(method, url, async, username ?? undefined, password ?? undefined)
    }

    override setRequestHeader(name: string, value: string): void {
      this._requestHeaders[String(name).toLowerCase()] = String(value)
      super.setRequestHeader(name, value)
    }

    override getResponseHeader(name: string): string | null {
      if (this._isIntercepted) {
        return this._mockHeaders[String(name).toLowerCase()] ?? null
      }
      return super.getResponseHeader(name)
    }

    override getAllResponseHeaders(): string {
      if (this._isIntercepted) {
        return Object.entries(this._mockHeaders)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n')
      }
      return super.getAllResponseHeaders()
    }

    override send(body?: Document | XMLHttpRequestBodyInit | null): void {
      const url = this._url ?? ''
      const method = (this._method ?? 'GET').toUpperCase()

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
        super.send(body ?? null)
        return
      }

      this._isIntercepted = true
      this._mockBody = rule.body ?? ''
      this._mockHeaders = normalizeHeaders(rule.headers)

      if (tryParseJson(this._mockBody)) {
        if (!this._mockHeaders['content-type']) {
          this._mockHeaders['content-type'] = 'application/json'
        }
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

      const run = async () => {
        const delay = Number.isFinite(rule.delayMs) ? Math.max(0, rule.delayMs) : 0
        if (delay > 0) await sleep(delay)

        // readyState + events are on the native XHR instance; we can simulate
        // by assigning standard response fields where allowed and emitting events.
        ;(this as any).status = rule.status
        ;(this as any).statusText = String(rule.status)
        ;(this as any).responseURL = url
        ;(this as any).responseType = (this as any).responseType ?? ''

        const responseText = this._mockBody
        ;(this as any).responseText = responseText
        ;(this as any).response = responseText

        // Trigger event listeners/callbacks in roughly correct order.
        const ev = (type: string) => {
          try {
            this.dispatchEvent(new Event(type))
          } catch {
            // ignore
          }
        }

        // Emulate the usual progression.
        ;(this as any).readyState = 2
        ;(this as any).onreadystatechange?.(new Event('readystatechange'))
        ev('readystatechange')

        ;(this as any).readyState = 3
        ;(this as any).onreadystatechange?.(new Event('readystatechange'))
        ev('readystatechange')

        ;(this as any).readyState = 4
        ;(this as any).onreadystatechange?.(new Event('readystatechange'))
        ev('readystatechange')

        ;(this as any).onload?.(new Event('load'))
        ev('load')
        ;(this as any).onloadend?.(new Event('loadend'))
        ev('loadend')
      }

      if (this._async) {
        void run()
        return
      }

      // Synchronous XHR is rare; best-effort (blocking) simulation.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      run()
    }
  }

  ;(window as any).XMLHttpRequest = InterceptedXHR

  return () => {
    ;(window as any).XMLHttpRequest = OriginalXHR
  }
}

