import { useEffect, useRef, useState } from 'react'
import { Header } from './components/Header'
import { SettingsPanel } from './components/SettingsPanel'
import { RuleForm } from './components/RuleForm'
import { RuleList } from './components/RuleList'
import { RequestLog } from './components/RequestLog'
import { useLogStore } from './store/logStore'
import { useRulesStore } from './store/rulesStore'

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result ?? 'null')))
      } catch {
        reject(new Error('Invalid JSON file.'))
      }
    }
    reader.readAsText(file)
  })
}

export default function App() {
  const rulesStore = useRulesStore()
  const logStore = useLogStore()
  const [importError, setImportError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    void rulesStore.refreshAll()

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (cancelled) return
      try {
        const ws = new WebSocket('ws://localhost:3001/ws')
        wsRef.current = ws
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(String(msg.data))
            if (data?.type === 'log' && data?.event) {
              logStore.appendFromServerEvent(data.event)
              if (data.event?.intercepted && data.event?.matchedRuleId) {
                rulesStore.markRuleHit(String(data.event.matchedRuleId), String(data.event.timestamp))
              }
            }
          } catch {
            // ignore
          }
        }
        ws.onclose = () => {
          wsRef.current = null
          if (!cancelled) retryTimer = setTimeout(connect, 2000)
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      wsRef.current?.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editingRule = rulesStore.editingRule

  const handleExport = async () => {
    downloadJson(
      `api-mock-interceptor-rules-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`,
      rulesStore.exportRules(),
    )
  }

  const handleImportFile = async (file: File) => {
    setImportError(null)
    try {
      const payload = await readJsonFile(file)
      const res = await rulesStore.importRulesReplaceAll(payload)
      if (!res.ok) setImportError(res.error)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <Header onExport={handleExport} onImportFile={handleImportFile} />

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          {rulesStore.connectionError ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <div className="font-medium text-amber-50">Proxy server not reachable</div>
              <p className="mt-1 text-amber-100/90">{rulesStore.connectionError}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15"
                  onClick={() => void rulesStore.refreshAll()}
                >
                  Retry
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5"
                  onClick={() => rulesStore.clearConnectionError()}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {importError ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {importError}
            </div>
          ) : null}

          <SettingsPanel
            value={rulesStore.targetBaseUrl}
            onSave={rulesStore.setTargetBaseUrl}
            onRefresh={rulesStore.refreshAll}
          />

          <RuleForm
            editingRule={editingRule}
            onCancelEdit={() => rulesStore.cancelEditing()}
          />
          <RuleList
            rules={rulesStore.rules}
            onEdit={(id) => rulesStore.startEditing(id)}
            onDelete={(id) => rulesStore.deleteRule(id)}
            onToggleEnabled={(id, enabled) => rulesStore.setRuleEnabled(id, enabled)}
          />
        </div>

        <div className="space-y-4">
          <RequestLog
            entries={logStore.entries}
            logPassthrough={logStore.logPassthrough}
            onClear={logStore.clear}
            onSetLogPassthrough={logStore.setLogPassthrough}
          />

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <div className="mb-2 text-sm font-medium text-white">Quick test</div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  await fetch('http://localhost:3001/api/users', { method: 'GET' })
                }}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Trigger proxy GET /api/users
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
