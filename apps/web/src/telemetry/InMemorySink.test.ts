import { describe, expect, it } from 'vitest'
import { InMemorySink } from './InMemorySink'
import { TEST_SESSION_CONFIG, TEST_SESSION_SUMMARY, makeTestAttempt } from './sinkTestFixtures'

describe('InMemorySink: stored data (debug helpers)', () => {
  it('stores the exact attempts recorded, in order', async () => {
    const sink = new InMemorySink()
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    const a0 = makeTestAttempt(id, 0, { correct: true })
    const a1 = makeTestAttempt(id, 1, { correct: false, timedOut: true, chosenIndex: null })
    await sink.recordAttempt(a0)
    await sink.recordAttempt(a1)

    expect(sink.getAttempts(id)).toEqual([a0, a1])
  })

  it('stores the session config, outcome, and summary after closing', async () => {
    const sink = new InMemorySink()
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    await sink.closeSession(id, 'completed', TEST_SESSION_SUMMARY)

    const session = sink.getSession(id)
    expect(session?.config).toEqual(TEST_SESSION_CONFIG)
    expect(session?.outcome).toBe('completed')
    expect(session?.summary).toEqual(TEST_SESSION_SUMMARY)
  })

  it('returns an empty attempts array for a session with none', async () => {
    const sink = new InMemorySink()
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    expect(sink.getAttempts(id)).toEqual([])
  })

  it('returns undefined for an unknown session id', () => {
    const sink = new InMemorySink()
    expect(sink.getSession('nope')).toBeUndefined()
  })
})
