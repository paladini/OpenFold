import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { DEFAULT_PROFILE_ID, openDb, OpenFoldDB, type SessionRow } from './storage/db'
import * as dbModule from './storage/db'
import { InMemorySink } from './telemetry/InMemorySink'
import type { TelemetrySink } from './telemetry/TelemetrySink'
import type { SessionId } from './telemetry/types'

vi.mock('./hooks/useProblemScene', () => ({
  useProblemScene: () => ({
    scene: { onSelect: () => () => {}, showFeedback: vi.fn(), playFold: vi.fn().mockResolvedValue(undefined), setInteractive: vi.fn() },
    error: null,
  }),
}))

vi.mock('./storage/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage/db')>()
  return { ...actual, openDb: vi.fn(actual.openDb) }
})

async function startRound(problemCount = 5): Promise<void> {
  await screen.findByLabelText('Difficulty')
  fireEvent.change(screen.getByLabelText('Problem count'), { target: { value: String(problemCount) } })
  fireEvent.click(screen.getByLabelText('Unlimited time'))
  fireEvent.click(screen.getByRole('button', { name: 'Start round' }))
}

async function answerOneItem(): Promise<void> {
  await screen.findByRole('button', { name: '1' })
  fireEvent.click(screen.getByRole('button', { name: '1' }))
  await screen.findByRole('button', { name: 'Next' })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

describe('App shell', () => {
  it('renders the config screen first', async () => {
    render(<App sink={new InMemorySink()} />)
    expect(await screen.findByLabelText('Difficulty')).toBeInTheDocument()
  })

  it('flows config -> play -> summary -> config across a full 5-item round', async () => {
    render(<App sink={new InMemorySink()} />)
    await startRound(5)

    for (let i = 0; i < 5; i++) {
      await answerOneItem()
    }

    expect(await screen.findByText('Retry same settings')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New round' }))
    expect(await screen.findByLabelText('Difficulty')).toBeInTheDocument()
  })

  it('Retry from summary starts a fresh round directly (not the config screen)', async () => {
    render(<App sink={new InMemorySink()} />)
    await startRound(5)
    for (let i = 0; i < 5; i++) await answerOneItem()

    await screen.findByRole('button', { name: 'Retry same settings' })
    fireEvent.click(screen.getByRole('button', { name: 'Retry same settings' }))
    expect(await screen.findByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Difficulty')).not.toBeInTheDocument()
  })

  it('aborting mid-round returns to the config screen', async () => {
    render(<App sink={new InMemorySink()} />)
    await startRound(5)
    await screen.findByRole('button', { name: 'Abort round' })
    fireEvent.click(screen.getByRole('button', { name: 'Abort round' }))
    expect(await screen.findByLabelText('Difficulty')).toBeInTheDocument()
  })

  it('shows a loading placeholder until boot-time pending-session reconciliation completes, closing the stale session first', async () => {
    const closeSession = vi.fn().mockResolvedValue(undefined)
    const sink: TelemetrySink = {
      openSession: vi.fn().mockResolvedValue('new-session' satisfies SessionId),
      recordAttempt: vi.fn().mockResolvedValue(undefined),
      closeSession,
      getPendingSession: vi.fn().mockResolvedValue('stale-session' satisfies SessionId),
      setPendingSession: vi.fn().mockResolvedValue(undefined),
    }

    render(<App sink={sink} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByLabelText('Difficulty')).not.toBeInTheDocument()

    await screen.findByLabelText('Difficulty')
    expect(closeSession).toHaveBeenCalledWith('stale-session', 'aborted', null)
  })

  it('does not attempt to close any session when there is no pending marker', async () => {
    const sink = new InMemorySink()
    const closeSpy = vi.spyOn(sink, 'closeSession')
    render(<App sink={sink} />)
    await screen.findByLabelText('Difficulty')
    expect(closeSpy).not.toHaveBeenCalled()
  })

  it('with no overrides, boots a real DexieSink and shows the Dashboard/History nav (no fallback notice)', async () => {
    render(<App />)
    await screen.findByLabelText('Difficulty')
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.queryByText(/History disabled/)).not.toBeInTheDocument()
  })

  it('falls back to InMemorySink with a persistent notice when IndexedDB is unavailable', async () => {
    vi.mocked(dbModule.openDb).mockRejectedValueOnce(new Error('indexedDB unavailable in this environment'))
    render(<App />)
    expect(await screen.findByText(/History disabled this session/)).toBeInTheDocument()
    expect(await screen.findByLabelText('Difficulty')).toBeInTheDocument() // the round loop still works
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'History' })).not.toBeInTheDocument()
  })

  it('navigates to the Dashboard and back to Play', async () => {
    render(<App sink={new InMemorySink()} />)
    await screen.findByLabelText('Difficulty')
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(await screen.findByText(/No history yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(await screen.findByLabelText('Difficulty')).toBeInTheDocument()
  })

  it('History -> Review -> Close returns to the History screen', async () => {
    const db = await openDb(new OpenFoldDB('app-history-review-test'))
    const session: SessionRow = {
      id: 's1',
      profileId: DEFAULT_PROFILE_ID,
      startedAt: Date.now(),
      finishedAt: Date.now() + 1000,
      outcome: 'completed',
      config: { difficulty: 'medium', problemCount: 1, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
      summary: { attempts: 1, correct: 1, accuracy: 1, meanResponseMs: 900, medianResponseMs: 900 },
    }
    await db.sessions.add(session)
    await db.attempts.add({ id: 'a1', sessionId: 's1', itemIndex: 0, seed: 5, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: Date.now() })

    render(<App sink={new InMemorySink()} db={db} />)
    await screen.findByLabelText('Difficulty')
    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    fireEvent.click(await screen.findByRole('button', { name: /medium/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    expect(await screen.findByText(/Review: seed 5/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(await screen.findByRole('button', { name: /medium/ })).toBeInTheDocument() // back on History
  })
})
