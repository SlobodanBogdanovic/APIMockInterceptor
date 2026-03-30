/** Backend port when using the default dev layout (Express + Vite). */
const API_PORT = 3001

/**
 * Base URL for the proxy API. Uses the page hostname so LAN access works; override with `VITE_API_BASE`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window === 'undefined') return `http://127.0.0.1:${API_PORT}`
  const { protocol, hostname } = window.location
  const http = protocol === 'https:' ? 'https:' : 'http:'
  return `${http}//${hostname}:${API_PORT}`
}

/** WebSocket URL for the request log stream (same host as `getApiBaseUrl`). */
export function getLogWsUrl(): string {
  const u = new URL(getApiBaseUrl())
  const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${wsProto}//${u.host}/ws`
}
