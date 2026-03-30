import type { ChangeEvent } from 'react'

type Props = {
  onExport: () => Promise<void> | void
  onImportFile: (file: File) => Promise<void> | void
}

export function Header({ onExport, onImportFile }: Props) {
  const handleImportChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void onImportFile(file)
    e.target.value = ''
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">API Mock Interceptor</div>
          <div className="text-xs text-white/60">
            Monkey-patch fetch/XHR to return synthetic responses for matching rules.
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void onExport()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10"
          >
            Export rules
          </button>

          <label className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10">
            Import rules
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImportChange}
            />
          </label>
        </div>
      </div>
    </header>
  )
}

