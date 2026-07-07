import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CompletedItem, RoundState } from '../round/roundMachine'
import type { SessionConfig } from '../telemetry/types'
import { SummaryScreen } from './SummaryScreen'

const CONFIG: SessionConfig = { difficulty: 'medium', problemCount: 3, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 7 }

const ITEMS: CompletedItem[] = [
  { itemIndex: 0, seed: 1, mode: 'fold', chosenIndex: 2, correctIndex: 2, correct: true, timedOut: false, suspect: false, responseMs: 900 },
  { itemIndex: 1, seed: 2, mode: 'fold', chosenIndex: 1, correctIndex: 2, correct: false, timedOut: false, suspect: false, responseMs: 2000 },
  { itemIndex: 2, seed: 3, mode: 'fold', chosenIndex: null, correctIndex: 2, correct: false, timedOut: true, suspect: false, responseMs: 30_000 },
]

function summaryState(overrides: Partial<Extract<RoundState, { phase: 'summary' }>> = {}): Extract<RoundState, { phase: 'summary' }> {
  return {
    phase: 'summary',
    sessionId: 's1',
    config: CONFIG,
    completedItems: ITEMS,
    summary: { attempts: 3, correct: 1, accuracy: 1 / 3, meanResponseMs: 1500, medianResponseMs: 1000 },
    outcome: 'completed',
    ...overrides,
  }
}

describe('SummaryScreen', () => {
  it('renders accuracy, correct count, mean and median response time', () => {
    render(<SummaryScreen state={summaryState()} onRetry={() => {}} onNewRound={() => {}} />)
    expect(screen.getByText('33.3%')).toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('1500 ms')).toBeInTheDocument()
    expect(screen.getByText('1000 ms')).toBeInTheDocument()
  })

  it('renders a per-item row for every completed item, flagging timeouts', () => {
    render(<SummaryScreen state={summaryState()} onRetry={() => {}} onNewRound={() => {}} />)
    const table = within(screen.getByRole('table'))
    expect(table.getByText('Correct')).toBeInTheDocument()
    expect(table.getByText('Incorrect')).toBeInTheDocument()
    expect(table.getByText('Timeout')).toBeInTheDocument()
  })

  it('shows an aborted banner when outcome is aborted', () => {
    render(<SummaryScreen state={summaryState({ outcome: 'aborted' })} onRetry={() => {}} onNewRound={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent(/aborted/i)
  })

  it('does not show an aborted banner when outcome is completed', () => {
    render(<SummaryScreen state={summaryState()} onRetry={() => {}} onNewRound={() => {}} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('Retry dispatches the same config with a freshly generated seed', () => {
    const onRetry = vi.fn()
    render(<SummaryScreen state={summaryState()} onRetry={onRetry} onNewRound={() => {}} generateSeed={() => 999} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry same settings' }))
    expect(onRetry).toHaveBeenCalledWith({ ...CONFIG, sessionSeed: 999 })
  })

  it('New round calls onNewRound', () => {
    const onNewRound = vi.fn()
    render(<SummaryScreen state={summaryState()} onRetry={() => {}} onNewRound={onNewRound} />)
    fireEvent.click(screen.getByRole('button', { name: 'New round' }))
    expect(onNewRound).toHaveBeenCalledTimes(1)
  })
})
