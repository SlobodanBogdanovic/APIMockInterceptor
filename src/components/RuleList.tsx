import type { MockRule } from '../types'

type Props = {
  rules: MockRule[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

function methodColor(method: string) {
  switch (method) {
    case 'GET':
      return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
    case 'POST':
      return 'bg-sky-500/15 text-sky-200 border-sky-400/30'
    case 'PUT':
      return 'bg-amber-500/15 text-amber-200 border-amber-400/30'
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-200 border-rose-400/30'
    case 'PATCH':
      return 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30'
    default:
      return 'bg-zinc-500/15 text-zinc-200 border-zinc-400/30'
  }
}

export function RuleList({ rules, onEdit, onDelete, onToggleEnabled }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="text-sm font-medium text-white">Mock rules</div>
        <div className="text-xs text-white/60">{rules.length} total</div>
      </div>

      <div className="divide-y divide-white/10">
        {rules.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">
            No rules yet. Add one above, then trigger it with a fetch/XHR call.
          </div>
        ) : null}

        {rules.map((r) => {
          const hitRecently =
            r.lastHitAt && Date.now() - new Date(r.lastHitAt).getTime() < 1200
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${methodColor(
                        r.method,
                      )}`}
                    >
                      {r.method}
                    </span>
                    <span className="truncate text-sm font-medium text-white">{r.name}</span>
                    {hitRecently ? (
                      <span className="inline-flex items-center rounded-md bg-violet-500/20 px-2 py-0.5 text-xs text-violet-200">
                        HIT
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                    <span className="font-mono">{r.urlPattern}</span>
                    <span>Status {r.status}</span>
                    <span>{r.delayMs}ms delay</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <span>{r.enabled ? 'Enabled' : 'Disabled'}</span>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => onToggleEnabled(r.id, e.target.checked)}
                      className="h-4 w-4 accent-violet-400"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => onEdit(r.id)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    className="rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/15"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

