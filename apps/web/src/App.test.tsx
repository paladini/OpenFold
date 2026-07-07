import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { InMemorySink } from './telemetry/InMemorySink'
import type { TelemetrySink } from './telemetry/TelemetrySink'
import type { SessionId } from './telemetry/types'

vi.mock('./hooks/useProblemScene', () => ({
  useProblemScene: () => ({
    scene: { onSelect: () => () => {}, showFeedback: vi.fn(), playFold: vi.fn().mockResolvedValue(undefined) },
    error: null,
  }),
}))

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
})
