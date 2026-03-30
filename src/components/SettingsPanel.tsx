import { useEffect, useMemo, useState } from 'react'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
  onRefresh: () => Promise<void>
}

function normalizeBaseUrlInput(raw: string): { ok: true; url: string } | { ok: false } {
  const s = raw.trim()
  if (!s) return { ok: true, url: '' }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s) ? s : `http://${s}`
  try {
    const u = new URL(withProtocol)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false }
    // Keep as origin (plus any pathname user provided), but normalize trailing slash.
    const normalized = u.toString().replace(/\/+$/, '')
    return { ok: true, url: normalized }
  } catch {
    return { ok: false }
  }
}

export function SettingsPanel({ value, onSave, onRefresh }: Props) {
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const normalized = useMemo(() => normalizeBaseUrlInput(draft), [draft])
  const valid = normalized.ok

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">Proxy settings</div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      <label className="block">
        <div className="mb-1 text-xs text-white/60">Target Base URL</div>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setError(null)
          }}
          className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
          placeholder="e.g. https://jsonplaceholder.typicode.com or localhost:8080"
        />
      </label>

      {draft.trim() && valid ? (
        <div className="mt-1 text-xs text-emerald-300/80">
          Will use <span className="font-mono">{normalized.url}</span>
        </div>
      ) : null}
      {!valid ? (
        <div className="mt-1 text-xs text-rose-300/80">Must be a valid http(s) URL.</div>
      ) : null}
      {error ? (
        <div className="mt-2 text-xs text-rose-300/80">{error}</div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => {
            if (!valid) return
            setSaving(true)
            setError(null)
            void (async () => {
              try {
                await onSave(normalized.ok ? normalized.url : draft.trim())
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to save.')
              } finally {
                setSaving(false)
              }
            })()
          }}
          className="rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  )
}

