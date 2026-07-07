import { describe, expect, it } from 'vitest'
import type { TelemetrySink } from './TelemetrySink'
import { TEST_SESSION_CONFIG, TEST_SESSION_SUMMARY, makeTestAttempt } from './sinkTestFixtures'

/**
 * Behavioral contract shared by every TelemetrySink implementation. Call from a `.test.ts` file
 * for InMemorySink (game-rounds) and again for DexieSink (telemetry-analytics, M4) to guarantee
 * the boot-time swap between them is behavior-preserving.
 */
export function describeSinkContract(name: string, makeSink: () => TelemetrySink): void {
  describe(`TelemetrySink contract: ${name}`, () => {
    it('round-trips open -> record x N -> close with the given outcome and summary', async () => {
      const sink = makeSink()
      const id = await sink.openSession(TEST_SESSION_CONFIG)
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)

      for (let i = 0; i < 3; i++) {
        await sink.recordAttempt(makeTestAttempt(id, i))
      }

      await sink.closeSession(id, 'completed', TEST_SESSION_SUMMARY)
    })

    it('sets the pending-session marker on open', async () => {
      const sink = makeSink()
      expect(await sink.getPendingSession()).toBeNull()
      const id = await sink.openSession(TEST_SESSION_CONFIG)
      expect(await sink.getPendingSession()).toBe(id)
    })

    it('clears the pending-session marker on close, for a completed outcome', async () => {
      const sink = makeSink()
      const id = await sink.openSession(TEST_SESSION_CONFIG)
      await sink.closeSession(id, 'completed', TEST_SESSION_SUMMARY)
      expect(await sink.getPendingSession()).toBeNull()
    })

    it('clears the pending-session marker on close, for an aborted outcome', async () => {
      const sink = makeSink()
      const id = await sink.openSession(TEST_SESSION_CONFIG)
      await sink.recordAttempt(makeTestAttempt(id, 0))
      await sink.closeSession(id, 'aborted', null)
      expect(await sink.getPendingSession()).toBeNull()
    })

    it('clears the pending-session marker on close, for a failed outcome', async () => {
      const sink = makeSink()
      const id = await sink.openSession(TEST_SESSION_CONFIG)
      await sink.closeSession(id, 'failed', null)
      expect(await sink.getPendingSession()).toBeNull()
    })

    it('opening a second session while one is pending updates the marker to the new session', async () => {
      const sink = makeSink()
      const first = await sink.openSession(TEST_SESSION_CONFIG)
      const second = await sink.openSession(TEST_SESSION_CONFIG)
      expect(first).not.toBe(second)
      expect(await sink.getPendingSession()).toBe(second)
    })

    it('setPendingSession(null) can be called directly (boot-time reconciliation path)', async () => {
      const sink = makeSink()
      await sink.openSession(TEST_SESSION_CONFIG)
      await sink.setPendingSession(null)
      expect(await sink.getPendingSession()).toBeNull()
    })

    it('recording an attempt against an unknown session rejects', async () => {
      const sink = makeSink()
      await expect(sink.recordAttempt(makeTestAttempt('not-a-real-session', 0))).rejects.toThrow()
    })

    it('closing an unknown session rejects', async () => {
      const sink = makeSink()
      await expect(sink.closeSession('not-a-real-session', 'completed', TEST_SESSION_SUMMARY)).rejects.toThrow()
    })
  })
}
