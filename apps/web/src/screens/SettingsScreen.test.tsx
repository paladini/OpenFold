import 'fake-indexeddb/auto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROFILE_ID, OpenFoldDB, openDb, type SessionRow } from '../storage/db'
import { exportAll } from '../storage/exporter'
import { SettingsScreen } from './SettingsScreen'

let dbCounter = 0
function nextDbName(): string {
  dbCounter += 1
  return `settings-test-${dbCounter}`
}

function makeSession(id: string): SessionRow {
  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    startedAt: 1000,
    finishedAt: 2000,
    outcome: 'completed',
    config: { difficulty: 'medium', problemCount: 2, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
    summary: { attempts: 2, correct: 2, accuracy: 1, meanResponseMs: 900, medianResponseMs: 900 },
  }
}

describe('SettingsScreen', () => {
  it('Export history triggers a download of the current export envelope', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.add(makeSession('s1'))
    const triggerDownload = vi.fn()
    render(<SettingsScreen db={db} triggerDownload={triggerDownload} />)

    fireEvent.click(screen.getByRole('button', { name: 'Export history' }))
    await waitFor(() => expect(triggerDownload).toHaveBeenCalledTimes(1))

    const [blob, filename] = triggerDownload.mock.calls[0] as [Blob, string]
    expect(filename).toMatch(/openfold-export-.*\.json/)
    const data = JSON.parse(await blob.text())
    expect(data.sessions).toHaveLength(1)
  })

  it('importing a valid export file reports added/skipped counts', async () => {
    const source = await openDb(new OpenFoldDB(nextDbName()))
    await source.sessions.add(makeSession('s1'))
    const blob = await exportAll(source)
    const file = new File([blob], 'export.json', { type: 'application/json' })

    const target = await openDb(new OpenFoldDB(nextDbName()))
    render(<SettingsScreen db={target} />)

    fireEvent.change(screen.getByLabelText('Import history'), { target: { files: [file] } })

    expect(await screen.findByRole('status')).toHaveTextContent(/Added 1 sessions/)
  })

  it('importing an invalid file shows a typed error message', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<SettingsScreen db={db} />)

    const file = new File(['not json'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import history'), { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('re-importing the same file reports zero added, all skipped', async () => {
    const source = await openDb(new OpenFoldDB(nextDbName()))
    await source.sessions.add(makeSession('s1'))
    const blob = await exportAll(source)
    const file = new File([blob], 'export.json', { type: 'application/json' })

    const target = await openDb(new OpenFoldDB(nextDbName()))
    render(<SettingsScreen db={target} />)

    fireEvent.change(screen.getByLabelText('Import history'), { target: { files: [file] } })
    await screen.findByRole('status')

    fireEvent.change(screen.getByLabelText('Import history'), { target: { files: [file] } })
    expect(await screen.findByRole('status')).toHaveTextContent(/Added 0 sessions.*skipped 1 sessions/)
  })
})
