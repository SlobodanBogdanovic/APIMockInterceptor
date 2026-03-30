import type { IncomingHttpHeaders } from 'node:http'

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export type ForwardResult = {
  status: number
  headers: Headers
  body: ReadableStream<Uint8Array> | null
}

function toForwardHeaders(headers: IncomingHttpHeaders): Headers {
  const out = new Headers()
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase()
    if (HOP_BY_HOP.has(key)) continue
    if (typeof v === 'undefined') continue
    if (Array.isArray(v)) {
      for (const item of v) out.append(k, item)
    } else {
      out.set(k, v)
    }
  }
  return out
}

export async function forwardRequest(opts: {
  targetUrl: string
  method: string
  headers: IncomingHttpHeaders
  bodyBuffer?: Buffer
}): Promise<ForwardResult> {
  const { targetUrl, method, headers, bodyBuffer } = opts

  const init: RequestInit = {
    method,
    headers: toForwardHeaders(headers),
  }

  if (method !== 'GET' && method !== 'HEAD' && typeof bodyBuffer !== 'undefined') {
    init.body = bodyBuffer
  }

  const res = await fetch(targetUrl, init)

  return {
    status: res.status,
    headers: res.headers,
    body: res.body,
  }
}

