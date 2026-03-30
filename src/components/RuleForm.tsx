import { useEffect, useMemo, useState } from 'react'
import type { HeaderKV, HttpMethod, MockRule } from '../types'
import { createEmptyRuleDraft, type RuleDraft, useRulesStore } from '../store/rulesStore'

const METHODS: HttpMethod[] = ['ANY', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH']

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function coerceInt(value: string, fallback: number) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

function isValidJson(text: string): boolean {
  if (!text.trim()) return true
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

type Props = {
  editingRule: MockRule | null
  onCancelEdit: () => void
}

export function RuleForm({ editingRule, onCancelEdit }: Props) {
  const rulesStore = useRulesStore()

  const initialDraft: RuleDraft = useMemo(() => {
    if (!editingRule) return createEmptyRuleDraft()
    return {
      id: editingRule.id,
      name: editingRule.name,
      enabled: editingRule.enabled,
      method: editingRule.method,
      urlPattern: editingRule.urlPattern,
      status: editingRule.status,
      delayMs: editingRule.delayMs,
      headers:
        editingRule.headers.length > 0
          ? editingRule.headers
          : [{ id: createId(), key: '', value: '' }],
      body: editingRule.body,
    }
  }, [editingRule])

  const [draft, setDraft] = useState<RuleDraft>(initialDraft)

  useEffect(() => {
    setDraft(initialDraft)
  }, [initialDraft])

  const jsonOk = isValidJson(draft.body)

  const canSave = draft.urlPattern.trim().length > 0 && draft.status >= 100 && draft.status <= 599 && jsonOk

  const updateHeader = (id: string, patch: Partial<HeaderKV>) => {
    setDraft((d) => ({
      ...d,
      headers: d.headers.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }))
  }

  const addHeaderRow = () => {
    setDraft((d) => ({
      ...d,
      headers: [...d.headers, { id: createId(), key: '', value: '' }],
    }))
  }

  const removeHeaderRow = (id: string) => {
    setDraft((d) => ({
      ...d,
      headers: d.headers.filter((h) => h.id !== id),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return

    const cleaned: RuleDraft = {
      ...draft,
      name: draft.name.trim() || 'New rule',
      urlPattern: draft.urlPattern.trim(),
      delayMs: Math.max(0, draft.delayMs),
      status: Math.min(599, Math.max(100, draft.status)),
      headers: draft.headers.filter((h) => h.key.trim().length > 0),
    }

    if (editingRule) {
      rulesStore.updateRule(editingRule.id, cleaned)
      return
    }

    rulesStore.createRule(cleaned)
    setDraft(createEmptyRuleDraft())
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-white/10 bg-white/5 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">
          {editingRule ? 'Edit rule' : 'Add mock rule'}
        </div>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="h-4 w-4 accent-violet-400"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-xs text-white/60">Rule name</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
            placeholder="e.g. Mock users list"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-white/60">URL pattern</div>
          <input
            value={draft.urlPattern}
            onChange={(e) => setDraft((d) => ({ ...d, urlPattern: e.target.value }))}
            className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
            placeholder="e.g. */api/users*"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-white/60">HTTP method</div>
          <select
            value={draft.method}
            onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as HttpMethod }))}
            className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="mb-1 text-xs text-white/60">Status</div>
            <input
              value={String(draft.status)}
              onChange={(e) => setDraft((d) => ({ ...d, status: coerceInt(e.target.value, d.status) }))}
              inputMode="numeric"
              className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs text-white/60">Delay (ms)</div>
            <input
              value={String(draft.delayMs)}
              onChange={(e) => setDraft((d) => ({ ...d, delayMs: coerceInt(e.target.value, d.delayMs) }))}
              inputMode="numeric"
              className="w-full rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-xs text-white/60">Response headers</div>
            <button
              type="button"
              onClick={addHeaderRow}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10"
            >
              Add header
            </button>
          </div>
          <div className="space-y-2">
            {draft.headers.map((h) => (
              <div key={h.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                <input
                  value={h.key}
                  onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                  className="min-w-0 rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
                  placeholder="Header"
                />
                <input
                  value={h.value}
                  onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                  className="min-w-0 rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60"
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => removeHeaderRow(h.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/80 hover:bg-white/10"
                  aria-label="Remove header row"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="text-xs text-white/60">Response body (JSON)</div>
            <div className="text-xs">
              {jsonOk ? (
                <span className="text-emerald-300/80">Valid JSON</span>
              ) : (
                <span className="text-rose-300/80">Invalid JSON</span>
              )}
            </div>
          </div>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={10}
            className="w-full min-w-0 resize-y rounded-md border border-white/10 bg-zinc-950/40 px-3 py-2 font-mono text-sm text-white outline-none focus:border-violet-400/60"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {editingRule ? (
          <button
            type="button"
            onClick={() => {
              onCancelEdit()
              setDraft(createEmptyRuleDraft())
            }}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Cancel
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!canSave}
          className="rounded-md bg-violet-500 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editingRule ? 'Save changes' : 'Add rule'}
        </button>
      </div>
    </form>
  )
}

