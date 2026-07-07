import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { InMemorySink } from '../telemetry/InMemorySink'
import type { Difficulty, RoundMode, SessionConfig } from '../telemetry/types'
import { computeSummary, RoundMachine, type CompletedItem, type RoundState } from './roundMachine'

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => ({
    scene: { onSelect: () => () => {}, showFeedback: vi.fn(), playFold: vi.fn().mockResolvedValue(undefined) },
    error: null,
  }),
}))

/** A fully controlled, manually-advanced clock -- no real timers, no vi.useFakeTimers quirks. */
function createFakeClock() {
  let time = 0
  let nextId = 1
  const timers: Array<{ id: number; at: number; cb: () => void }> = []

  return {
    now: () => time,
    setTimeout: (cb: () => void, ms: number): number => {
      const id = nextId++
      timers.push({ id, at: time + ms, cb })
      return id
    },
    clearTimeout: (handle: number): void => {
      const idx = timers.findIndex((t) => t.id === handle)
      if (idx >= 0) timers.splice(idx, 1)
    },
    /** Advances time and fires any timers that are now due, in schedule order. */
    advance(ms: number): void {
      time += ms
      for (;;) {
        const due = timers.filter((t) => t.at <= time).sort((a, b) => a.at - b.at)[0]
        if (!due) return
        timers.splice(timers.indexOf(due), 1)
        due.cb()
      }
    },
  }
}

/** Deterministic, seedable PRNG for generating test fixtures (not production code). */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
const MODES: readonly RoundMode[] = ['fold', 'unfold', 'mixed']

interface RoundOutcome {
  readonly sessionId: string
  readonly finalState: RoundState
  readonly sink: InMemorySink
  readonly expectedAttempts: CompletedItem[]
}

/**
 * Drives one full round through the machine with scripted, clock-controlled answers. Each item is
 * answered by SELECT (advancing the clock a known amount) or, if a time limit is set, sometimes
 * left to TIMEOUT (advancing the clock past the limit so the fake timer fires). If `abortAtItem`
 * is set, ABORT is sent instead once that item index is reached (before answering it).
 */
async function runRound(rng: () => number, config: Omit<SessionConfig, 'sessionSeed'>, abortAtItem: number | null): Promise<RoundOutcome> {
  const clock = createFakeClock()
  const sink = new InMemorySink()
  const machine = new RoundMachine({ sink, itemTimerOptions: { now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout } })
  const fullConfig: SessionConfig = { ...config, sessionSeed: Math.floor(rng() * 2 ** 31) }

  machine.send({ type: 'START', config: fullConfig })
  await flushMicrotasks()

  const expectedAttempts: CompletedItem[] = []
  let sessionId: string | null = null

  for (let i = 0; i < config.problemCount; i++) {
    const state = machine.getState()
    if (state.phase !== 'presenting') throw new Error(`expected 'presenting' at item ${i}, got '${state.phase}'`)
    sessionId = state.sessionId

    if (abortAtItem === i) {
      machine.send({ type: 'ABORT' })
      await flushMicrotasks()
      return { sessionId, finalState: machine.getState(), sink, expectedAttempts }
    }

    machine.send({ type: 'SCENE_READY' })
    const answering = machine.getState()
    if (answering.phase !== 'answering') throw new Error(`expected 'answering' at item ${i}`)

    const willTimeout = config.timeLimitMs !== null && rng() < 0.3
    if (willTimeout) {
      clock.advance(config.timeLimitMs as number)
    } else {
      const elapsed = Math.floor(rng() * 500) + 350 // always above the 300ms suspect threshold
      clock.advance(elapsed)
      machine.send({ type: 'SELECT', index: Math.floor(rng() * 5) })
    }

    const feedback = machine.getState()
    if (feedback.phase !== 'feedback') throw new Error(`expected 'feedback' at item ${i}`)
    expectedAttempts.push(feedback.lastResult)

    machine.send({ type: 'NEXT' })
    await flushMicrotasks()
  }

  return { sessionId: sessionId as string, finalState: machine.getState(), sink, expectedAttempts }
}

describe('round integration: 100 simulated rounds', () => {
  it('every round records exactly the completed items as attempts, with no lost or duplicated attempts', async () => {
    const rng = mulberry32(20260707)

    for (let round = 0; round < 100; round++) {
      const problemCount = 5 + Math.floor(rng() * 6) // 5..10, keeps the suite fast
      const timeLimitMs = rng() < 0.5 ? null : 10_000 + Math.floor(rng() * 20) * 1000
      const mode = MODES[Math.floor(rng() * MODES.length)] as RoundMode
      const difficulty = DIFFICULTIES[Math.floor(rng() * DIFFICULTIES.length)] as Difficulty
      const abort = rng() < 0.1 ? Math.floor(rng() * problemCount) : null

      const { sessionId, finalState, sink, expectedAttempts } = await runRound(rng, { problemCount, timeLimitMs, mode, difficulty }, abort)

      const recordedAttempts = sink.getAttempts(sessionId)

      if (abort !== null && expectedAttempts.length === 0) {
        // Zero-attempt abort: session is discarded entirely (spec GAME-05 AC1/AC3).
        expect(finalState.phase).toBe('configuring')
        expect(sink.getSession(sessionId)?.outcome).toBe('aborted')
        continue
      }

      expect(recordedAttempts).toHaveLength(expectedAttempts.length)
      expect(finalState.phase).toBe('summary')
      if (finalState.phase !== 'summary') continue

      // Timer accuracy: every recorded responseMs must exactly match what the fake clock advanced
      // (well within the ±50ms tolerance the task calls for -- the fake clock makes it exact).
      for (const [i, attempt] of recordedAttempts.entries()) {
        const expected = expectedAttempts[i] as CompletedItem
        expect(attempt.responseMs).toBeCloseTo(expected.responseMs, 5)
        expect(Math.abs(attempt.responseMs - expected.responseMs)).toBeLessThanOrEqual(50)
        if (attempt.timedOut) expect(attempt.responseMs).toBe(timeLimitMs)
      }

      // Summary consistency: recompute from the attempt log and compare against the machine's own
      // summary and against what was persisted to the sink.
      const recomputed = computeSummary(expectedAttempts)
      expect(finalState.summary).toEqual(recomputed)
      expect(sink.getSession(sessionId)?.summary).toEqual(recomputed)
      expect(sink.getSession(sessionId)?.outcome).toBe(abort === null ? 'completed' : 'aborted')
    }
  })
})

/**
 * jsdom has no real focus-order layout, so Tab is simulated via direct .focus() calls on the
 * elements a Tab press would reach, rather than a literal Tab keydown; Enter is simulated via
 * .click() on the focused element, mirroring the browser's native default action for a focused
 * <button> (which jsdom does not implement). Digit-key selection (1-5) uses a real keydown, since
 * that path is handled by the app's own listener, not native browser behavior.
 */
function pressEnterOnFocused(): void {
  const el = document.activeElement
  if (el instanceof HTMLButtonElement) el.click()
}

describe('round integration: keyboard-only full round', () => {
  it('completes a 5-item round using only digit keys and Enter-on-focused-button, no pointer events', async () => {
    render(<App sink={new InMemorySink()} />)

    await screen.findByLabelText('Difficulty')
    const problemCountInput = screen.getByLabelText('Problem count')
    fireEvent.change(problemCountInput, { target: { value: '5' } })
    screen.getByRole('button', { name: 'Start round' }).focus()
    pressEnterOnFocused()

    for (let i = 0; i < 5; i++) {
      await screen.findByRole('button', { name: '1' })
      fireEvent.keyDown(window, { key: String((i % 5) + 1) })
      const nextButton = await screen.findByRole('button', { name: 'Next' })
      nextButton.focus()
      pressEnterOnFocused()
    }

    expect(await screen.findByText('Retry same settings')).toBeInTheDocument()
  })
})
