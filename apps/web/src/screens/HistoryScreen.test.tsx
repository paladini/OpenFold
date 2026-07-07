import 'fake-indexeddb/auto'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROFILE_ID, OpenFoldDB, openDb, type AttemptRow, type SessionRow } from '../storage/db'
import { HistoryScreen } from './HistoryScreen'

let dbCounter = 0
function nextDbName(): string {
  dbCounter += 1
  return `history-test-${dbCounter}`
}

function makeSession(id: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    startedAt: Date.now(),
    finishedAt: Date.now() + 1000,
    outcome: 'completed',
    config: { difficulty: 'medium', problemCount: 2, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
    summary: { attempts: 2, correct: 1, accuracy: 0.5, meanResponseMs: 1000, medianResponseMs: 1000 },
    ...overrides,
  }
}

describe('HistoryScreen', () => {
  it('shows an empty state when there are no sessions', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={() => {}} />)
    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument()
  })

  it('lists sessions newest-first with date, config summary, accuracy, and an outcome badge', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.bulkAdd([
      makeSession('older', { startedAt: 1000 }),
      makeSession('newer', { startedAt: 2000, outcome: 'aborted', summary: { attempts: 1, correct: 0, accuracy: 0, meanResponseMs: 1000, medianResponseMs: 1000 } }),
    ])
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={() => {}} />)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toMatch(/medium/)
    expect(items[0]?.textContent).toMatch(/Aborted/) // newer (aborted) session listed first
    expect(items[1]?.textContent).toMatch(/Completed/)
  })

  it('excludes zero-attempt aborted sessions', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.add(makeSession('discarded', { outcome: 'aborted', summary: null }))
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={() => {}} />)
    expect(await screen.findByText(/No sessions yet/)).toBeInTheDocument()
  })

  it('lazy-loads attempts only when a session row is expanded', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.add(makeSession('s1'))
    const attempts: AttemptRow[] = [
      { id: 'a1', sessionId: 's1', itemIndex: 0, seed: 11, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: Date.now() },
    ]
    await db.attempts.bulkAdd(attempts)
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={() => {}} />)

    await screen.findAllByRole('listitem')
    expect(screen.queryByText(/Item 1/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /medium/ }))
    expect(await screen.findByText(/Item 1: Correct/)).toBeInTheDocument()
  })

  it('collapses an expanded session on a second click', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.add(makeSession('s1'))
    await db.attempts.add({ id: 'a1', sessionId: 's1', itemIndex: 0, seed: 11, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: Date.now() })
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={() => {}} />)

    const toggle = await screen.findByRole('button', { name: /medium/ })
    fireEvent.click(toggle)
    await screen.findByText(/Item 1/)
    fireEvent.click(toggle)
    expect(screen.queryByText(/Item 1/)).not.toBeInTheDocument()
  })

  it('Review emits seed, config, mode, and chosenIndex for the clicked attempt', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    const session = makeSession('s1')
    await db.sessions.add(session)
    await db.attempts.add({
      id: 'a1', sessionId: 's1', itemIndex: 0, seed: 42, mode: 'unfold', difficulty: 'medium', chosenIndex: 3, correctIndex: 1, correct: false, timedOut: false, suspect: false, responseMs: 1500, answeredAt: Date.now(),
    })
    const onReview = vi.fn()
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} onReview={onReview} />)

    fireEvent.click(await screen.findByRole('button', { name: /medium/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))

    expect(onReview).toHaveBeenCalledWith({ seed: 42, config: session.config, mode: 'unfold', chosenIndex: 3 })
  })

  it('paginates: Previous is disabled on the first page, Next disabled when a page is short', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.add(makeSession('only'))
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} pageSize={10} onReview={() => {}} />)
    await screen.findAllByRole('listitem')
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('Next advances the offset and re-queries', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.sessions.bulkAdd([makeSession('a', { startedAt: 3 }), makeSession('b', { startedAt: 2 }), makeSession('c', { startedAt: 1 })])
    render(<HistoryScreen db={db} profileId={DEFAULT_PROFILE_ID} pageSize={2} onReview={() => {}} />)

    const firstPage = await screen.findAllByRole('listitem')
    expect(firstPage).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findAllByRole('listitem')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
