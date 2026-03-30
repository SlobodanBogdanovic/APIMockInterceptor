import { useEffect, useMemo, useRef, useState } from 'react'
import type { RequestLogEntry } from '../types'

type Props = {
  entries: RequestLogEntry[]
  logPassthrough: boolean
  onClear: () => void
  onSetLogPassthrough: (value: boolean) => void
}

export function RequestLog({
  entries,
  logPassthrough,
  onClear,
  onSetLogPassthrough,
}: Props) {
  const [interceptedOnly, setInterceptedOnly] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const shown = useMemo(() => {
    return entries.filter((e) => (interceptedOnly ? e.intercepted : true))
  }, [entries, interceptedOnly])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [shown.length])

  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-sm font-medium text-white">Request log</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-white/70">
            <span>Intercepted only</span>
            <input
              type="checkbox"
              checked={interceptedOnly}
              onChange={(e) => setInterceptedOnly(e.target.checked)}
              className="h-4 w-4 accent-violet-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <span>Log passthrough</span>
            <input
              type="checkbox"
              checked={logPassthrough}
              onChange={(e) => onSetLogPassthrough(e.target.checked)}
              className="h-4 w-4 accent-violet-400"
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-[150px_70px_1fr_140px_80px] gap-2 border-b border-white/10 pb-2 text-xs text-white/60">
          <div>Timestamp</div>
          <div>Method</div>
          <div>URL</div>
          <div>Matched rule</div>
          <div>Status</div>
        </div>
        <div
          ref={containerRef}
          className="mt-2 max-h-[320px] overflow-auto pr-2"
        >
          {shown.length === 0 ? (
            <div className="py-6 text-sm text-white/60">
              No log entries yet.
            </div>
          ) : null}

          <div className="space-y-2">
            {shown
              .slice(-300)
              .map((e) => (
                <div
                  key={e.id}
                  className="grid grid-cols-[150px_70px_1fr_140px_80px] gap-2 text-xs"
                >
                  <div className="font-mono text-white/70">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="font-mono text-white/80">{e.method}</div>
                  <div className="truncate font-mono text-white/70">{e.url}</div>
                  <div className="truncate text-white/70">
                    {e.intercepted ? e.matchedRuleName ?? '-' : '-'}
                  </div>
                  <div className="font-mono text-white/80">
                    {typeof e.status === 'number' ? e.status : e.intercepted ? '?' : '-'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

