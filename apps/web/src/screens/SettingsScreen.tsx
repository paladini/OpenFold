import { useState, type ChangeEvent } from 'react'
import type { OpenFoldDB } from '../storage/db'
import { exportAll, ImportValidationError, importFile, type ImportResult } from '../storage/exporter'

export interface SettingsScreenProps {
  readonly db: OpenFoldDB
  readonly triggerDownload?: (blob: Blob, filename: string) => void
}

function defaultTriggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsScreen({ db, triggerDownload = defaultTriggerDownload }: SettingsScreenProps): JSX.Element {
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExport(): Promise<void> {
    const blob = await exportAll(db)
    triggerDownload(blob, `openfold-export-${Date.now()}.json`)
  }

  async function handleImport(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setImportError(null)
    try {
      const result = await importFile(db, file)
      setImportResult(result)
    } catch (err) {
      setImportError(err instanceof ImportValidationError ? err.message : 'Import failed')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div>
      <h2>Data</h2>
      <button type="button" onClick={() => void handleExport()}>
        Export history
      </button>

      <label>
        Import history
        <input type="file" accept="application/json" aria-label="Import history" onChange={(e) => void handleImport(e)} />
      </label>

      {importResult && (
        <p role="status">
          Added {importResult.added.sessions} sessions, {importResult.added.attempts} attempts (skipped {importResult.skipped.sessions} sessions,{' '}
          {importResult.skipped.attempts} attempts already present)
        </p>
      )}
      {importError && <p role="alert">{importError}</p>}
    </div>
  )
}
