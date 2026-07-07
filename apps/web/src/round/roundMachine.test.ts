import { describe, expect, it } from 'vitest'
import { InMemorySink } from '../telemetry/InMemorySink'
import type { SessionConfig } from '../telemetry/types'
import { computeSummary, ConfigValidationError, RoundMachine, type CompletedItem } from './roundMachine'

function makeFakeClock() {
  let time = 0
  const timeouts: Array<{ handle: number; cb: () => void; due: number }> = []
  let nextHandle = 1
  return {
    now: () => time,
    setTimeout: (cb: () => void, ms: number) => {
      const handle = nextHandle++
      timeouts.push({ handle, cb, due: time + ms })
      return handle
    },
    clearTimeout: (handle: number) => {
      const idx = timeouts.findIndex((t) => t.handle === handle)
      if (idx >= 0) timeouts.splice(idx, 1)
    },
    advance(ms: number) {
      time += ms
      const due = timeouts.filter((t) => t.due <= time)
      for (const t of due) {
        const idx = timeouts.indexOf(t)
        if (idx >= 0) timeouts.splice(idx, 1)
        t.cb()
      }
    },
  }
}

function makeConfig(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return { difficulty: 'medium', problemCount: 5, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1, ...overrides }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function makeMachine(clock = makeFakeClock()) {
  const sink = new InMemorySink()
  const machine = new RoundMachine({ sink, now: clock.now, itemTimerOptions: clock })
  return { machine, sink, clock }
}

describe('RoundMachine: happy path', () => {
  it('configuring -> presenting -> answering -> feedback -> presenting -> ... -> summary', async () => {
    const { machine, clock } = makeMachine()
    expect(machine.getState().phase).toBe('configuring')

    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    expect(machine.getState().phase).toBe('presenting')

    machine.send({ type: 'SCENE_READY' })
    expect(machine.getState().phase).toBe('answering')

    machine.send({ type: 'SELECT', index: 0 })
    expect(machine.getState().phase).toBe('feedback')

    machine.send({ type: 'NEXT' })
    expect(machine.getState().phase).toBe('presenting')
    expect((machine.getState() as { itemIndex: number }).itemIndex).toBe(1)

    // Complete the remaining 4 items.
    for (let i = 1; i < 5; i++) {
      machine.send({ type: 'SCENE_READY' })
      clock.advance(500)
      machine.send({ type: 'SELECT', index: 0 })
      machine.send({ type: 'NEXT' })
    }

    const final = machine.getState()
    expect(final.phase).toBe('summary')
    if (final.phase === 'summary') {
      expect(final.outcome).toBe('completed')
      expect(final.completedItems).toHaveLength(5)
    }
  })

  it('a timed-out item transitions answering -> feedback via TIMEOUT', async () => {
    const { machine, clock } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    machine.send({ type: 'SCENE_READY' })
    clock.advance(30_000)

    const state = machine.getState()
    expect(state.phase).toBe('feedback')
    if (state.phase === 'feedback') {
      expect(state.lastResult.timedOut).toBe(true)
      expect(state.lastResult.chosenIndex).toBeNull()
      expect(state.lastResult.correct).toBe(false)
    }
  })
})

describe('RoundMachine: attempt recording invariants', () => {
  it('exactly one attempt is recorded per completed item (SELECT path)', async () => {
    const { machine, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId

    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SELECT', index: 1 })
    machine.send({ type: 'NEXT' })
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SELECT', index: 0 })

    expect(sink.getAttempts(sessionId)).toHaveLength(2)
  })

  it('an item aborted while answering (in-flight) records zero attempts for it', async () => {
    const { machine, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId

    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SELECT', index: 0 }) // completes item 0
    machine.send({ type: 'NEXT' })
    machine.send({ type: 'SCENE_READY' }) // item 1 now answering, in-flight
    machine.send({ type: 'ABORT' })

    expect(sink.getAttempts(sessionId)).toHaveLength(1) // only item 0
    const state = machine.getState()
    expect(state.phase).toBe('summary')
    if (state.phase === 'summary') expect(state.outcome).toBe('aborted')
  })

  it('a timeout that races a SELECT in the same tick resolves deterministically: first event wins', async () => {
    const { machine, clock } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5, timeLimitMs: 10_000 }) })
    await flush()
    machine.send({ type: 'SCENE_READY' })

    // Fire TIMEOUT first, then attempt a SELECT immediately after -- SELECT must be ignored.
    clock.advance(10_000)
    machine.send({ type: 'SELECT', index: 0 })

    const state = machine.getState()
    expect(state.phase).toBe('feedback')
    if (state.phase === 'feedback') {
      expect(state.lastResult.timedOut).toBe(true) // TIMEOUT won, not the late SELECT
    }
  })

  it('a second SELECT after the first is ignored (no double-recording)', async () => {
    const { machine, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SELECT', index: 0 })
    machine.send({ type: 'SELECT', index: 1 }) // should be a no-op
    expect(sink.getAttempts(sessionId)).toHaveLength(1)
    expect(sink.getAttempts(sessionId)[0]?.chosenIndex).toBe(0)
  })
})

describe('RoundMachine: ABORT from every state', () => {
  it('ABORT from presenting (before any answer) with zero completed items returns to configuring, discarding the session', async () => {
    const { machine, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId
    machine.send({ type: 'ABORT' })
    expect(machine.getState().phase).toBe('configuring')
    expect(sink.getSession(sessionId)?.outcome).toBe('aborted')
    expect(sink.getAttempts(sessionId)).toHaveLength(0)
  })

  it('ABORT from answering (in-flight, zero completed) returns to configuring', async () => {
    const { machine } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'ABORT' })
    expect(machine.getState().phase).toBe('configuring')
  })

  it('ABORT from feedback (at least one completed item) goes to summary with outcome=aborted', async () => {
    const { machine } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5 }) })
    await flush()
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SELECT', index: 0 })
    machine.send({ type: 'ABORT' })
    const state = machine.getState()
    expect(state.phase).toBe('summary')
    if (state.phase === 'summary') {
      expect(state.outcome).toBe('aborted')
      expect(state.completedItems).toHaveLength(1)
    }
  })

  it('ABORT while configuring is a no-op', () => {
    const { machine } = makeMachine()
    machine.send({ type: 'ABORT' })
    expect(machine.getState().phase).toBe('configuring')
  })

  it('a TIMEOUT scheduled before ABORT does not fire after the round was aborted', async () => {
    const { machine, clock, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ problemCount: 5, timeLimitMs: 10_000 }) })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'ABORT' })
    clock.advance(20_000) // would have fired the timeout if not cancelled
    expect(machine.getState().phase).toBe('configuring')
    expect(sink.getAttempts(sessionId)).toHaveLength(0)
  })
})

describe('RoundMachine: SCENE_ERROR', () => {
  it('SCENE_ERROR from presenting transitions to failed and closes the session', async () => {
    const { machine, sink } = makeMachine()
    machine.send({ type: 'START', config: makeConfig() })
    await flush()
    const sessionId = (machine.getState() as { sessionId: string }).sessionId
    machine.send({ type: 'SCENE_ERROR', message: 'WebGL unavailable' })
    const state = machine.getState()
    expect(state.phase).toBe('failed')
    if (state.phase === 'failed') expect(state.message).toBe('WebGL unavailable')
    expect(sink.getSession(sessionId)?.outcome).toBe('failed')
  })

  it('SCENE_ERROR from answering also transitions to failed', async () => {
    const { machine } = makeMachine()
    machine.send({ type: 'START', config: makeConfig() })
    await flush()
    machine.send({ type: 'SCENE_READY' })
    machine.send({ type: 'SCENE_ERROR', message: 'context lost' })
    expect(machine.getState().phase).toBe('failed')
  })

  it('ACKNOWLEDGE from failed returns to configuring', async () => {
    const { machine } = makeMachine()
    machine.send({ type: 'START', config: makeConfig() })
    await flush()
    machine.send({ type: 'SCENE_ERROR', message: 'oops' })
    machine.send({ type: 'ACKNOWLEDGE' })
    expect(machine.getState().phase).toBe('configuring')
  })
})

describe('RoundMachine: config validation', () => {
  it('rejects problemCount below the minimum', () => {
    const { machine } = makeMachine()
    expect(() => machine.send({ type: 'START', config: makeConfig({ problemCount: 4 }) })).toThrow(ConfigValidationError)
  })

  it('rejects problemCount above the maximum', () => {
    const { machine } = makeMachine()
    expect(() => machine.send({ type: 'START', config: makeConfig({ problemCount: 51 }) })).toThrow(ConfigValidationError)
  })

  it('rejects a timeLimitMs below the minimum', () => {
    const { machine } = makeMachine()
    expect(() => machine.send({ type: 'START', config: makeConfig({ timeLimitMs: 5000 }) })).toThrow(ConfigValidationError)
  })

  it('rejects a timeLimitMs above the maximum', () => {
    const { machine } = makeMachine()
    expect(() => machine.send({ type: 'START', config: makeConfig({ timeLimitMs: 200_000 }) })).toThrow(ConfigValidationError)
  })

  it('accepts timeLimitMs: null (unlimited)', async () => {
    const { machine } = makeMachine()
    machine.send({ type: 'START', config: makeConfig({ timeLimitMs: null }) })
    await flush()
    expect(machine.getState().phase).toBe('presenting')
  })
})

describe('RoundMachine: reproducibility', () => {
  it('the same sessionSeed produces the same sequence of item seeds', async () => {
    const { machine: m1 } = makeMachine()
    const { machine: m2 } = makeMachine()
    const config = makeConfig({ problemCount: 5, sessionSeed: 777 })
    m1.send({ type: 'START', config })
    m2.send({ type: 'START', config })
    await flush()

    const seeds = (m: RoundMachine): number[] => {
      const s = m.getState()
      const out: number[] = []
      // Walk through all 5 items collecting seeds via feedback state after each SELECT.
      let cur = s
      for (let i = 0; i < config.problemCount; i++) {
        m.send({ type: 'SCENE_READY' })
        m.send({ type: 'SELECT', index: 0 })
        cur = m.getState()
        if (cur.phase === 'feedback') out.push(cur.lastResult.seed)
        if (i < config.problemCount - 1) m.send({ type: 'NEXT' })
      }
      return out
    }

    expect(seeds(m1)).toEqual(seeds(m2))
  })
})

describe('computeSummary', () => {
  const item = (overrides: Partial<CompletedItem>): CompletedItem => ({
    itemIndex: 0,
    seed: 1,
    mode: 'fold',
    chosenIndex: 0,
    correctIndex: 0,
    correct: true,
    timedOut: false,
    suspect: false,
    responseMs: 1000,
    ...overrides,
  })

  it('computes accuracy counting timeouts as incorrect', () => {
    const items = [item({ correct: true }), item({ correct: false, timedOut: true, chosenIndex: null })]
    const summary = computeSummary(items)
    expect(summary.attempts).toBe(2)
    expect(summary.correct).toBe(1)
    expect(summary.accuracy).toBe(0.5)
  })

  it('excludes suspect and timed-out attempts from latency aggregates', () => {
    const items = [
      item({ responseMs: 100, suspect: true }),
      item({ responseMs: 50_000, timedOut: true, correct: false }),
      item({ responseMs: 1000 }),
      item({ responseMs: 2000 }),
    ]
    const summary = computeSummary(items)
    expect(summary.meanResponseMs).toBe(1500)
    expect(summary.medianResponseMs).toBe(1500)
  })

  it('returns zeroed aggregates for an empty item list', () => {
    const summary = computeSummary([])
    expect(summary).toEqual({ attempts: 0, correct: 0, accuracy: 0, meanResponseMs: 0, medianResponseMs: 0 })
  })

  it('computes the median correctly for an odd number of latency samples', () => {
    const items = [item({ responseMs: 100 }), item({ responseMs: 300 }), item({ responseMs: 200 })]
    expect(computeSummary(items).medianResponseMs).toBe(200)
  })
})
