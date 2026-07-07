import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_SESSION_CONFIG, makeTestAttempt } from '../telemetry/sinkTestFixtures'
import { DexieSink } from './DexieSink'
import { DEFAULT_PROFILE_ID, OpenFoldDB } from './db'

let dbCounter = 0
function freshDb(): OpenFoldDB {
  dbCounter += 1
  return new OpenFoldDB(`dexie-sink-test-${dbCounter}`)
}

describe('DexieSink', () => {
  let db: OpenFoldDB
  let sink: DexieSink

  beforeEach(() => {
    db = freshDb()
    sink = new DexieSink(db, DEFAULT_PROFILE_ID)
  })

  it('persists the session row on open', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    const row = await db.sessions.get(id)
    expect(row?.config).toEqual(TEST_SESSION_CONFIG)
    expect(row?.outcome).toBeNull()
    expect(row?.finishedAt).toBeNull()
  })

  it('writes an attempt and upserts a matching dailyStats row transactionally', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    await sink.recordAttempt(makeTestAttempt(id, 0))

    const attempts = await db.attempts.toArray()
    expect(attempts).toHaveLength(1)

    const stats = await db.dailyStats.toArray()
    expect(stats).toHaveLength(1)
    expect(stats[0]?.attempts).toBe(1)
    expect(stats[0]?.correct).toBe(1)
  })

  it('accumulates dailyStats across multiple attempts on the same day/difficulty', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    await sink.recordAttempt(makeTestAttempt(id, 0, { correct: true, responseMs: 1000 }))
    await sink.recordAttempt(makeTestAttempt(id, 1, { correct: false, responseMs: 2000 }))

    const stats = await db.dailyStats.toArray()
    expect(stats).toHaveLength(1)
    expect(stats[0]?.attempts).toBe(2)
    expect(stats[0]?.correct).toBe(1)
    expect(stats[0]?.latencySumMs).toBe(3000)
    expect(stats[0]?.latencyCount).toBe(2)
  })

  it('excludes suspect and timed-out attempts from the dailyStats latency aggregate', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    await sink.recordAttempt(makeTestAttempt(id, 0, { suspect: true, responseMs: 50 }))
    await sink.recordAttempt(makeTestAttempt(id, 1, { timedOut: true, correct: false, responseMs: 30_000 }))

    const stats = await db.dailyStats.toArray()
    expect(stats[0]?.attempts).toBe(2)
    expect(stats[0]?.latencyCount).toBe(0)
    expect(stats[0]?.latencySumMs).toBe(0)
  })

  it('closeSession writes the outcome, summary, and finishedAt', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    await sink.closeSession(id, 'completed', { attempts: 1, correct: 1, accuracy: 1, meanResponseMs: 900, medianResponseMs: 900 })
    const row = await db.sessions.get(id)
    expect(row?.outcome).toBe('completed')
    expect(row?.summary?.accuracy).toBe(1)
    expect(row?.finishedAt).not.toBeNull()
  })

  it('a mid-transaction failure leaves neither the attempt nor the dailyStats row persisted (atomicity)', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    const putSpy = vi.spyOn(db.dailyStats, 'put').mockRejectedValueOnce(new Error('simulated quota exceeded'))

    await sink.recordAttempt(makeTestAttempt(id, 0))

    expect(await db.attempts.count()).toBe(0) // rolled back with the dailyStats failure
    expect(await db.dailyStats.count()).toBe(0)
    putSpy.mockRestore()
  })

  it('buffers an attempt that fails to write and retries it on the next write, emitting one warning', async () => {
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    const warnings: string[] = []
    sink.onWarning((msg) => warnings.push(msg))

    const txnSpy = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('simulated failure'))
    await sink.recordAttempt(makeTestAttempt(id, 0))
    expect(await db.attempts.count()).toBe(0)
    expect(warnings).toHaveLength(1)
    txnSpy.mockRestore()

    await sink.recordAttempt(makeTestAttempt(id, 1))
    expect(await db.attempts.count()).toBe(2) // both the retried buffered row and the new one
    expect(warnings).toHaveLength(1) // still only emitted once
  })

  it('recording an attempt against an unknown session rejects without buffering', async () => {
    await expect(sink.recordAttempt(makeTestAttempt('not-a-real-session', 0))).rejects.toThrow()
    expect(await db.attempts.count()).toBe(0)
  })

  it('boot-time reconciliation: getPendingSession/setPendingSession round-trip through settings', async () => {
    expect(await sink.getPendingSession()).toBeNull()
    const id = await sink.openSession(TEST_SESSION_CONFIG)
    expect(await sink.getPendingSession()).toBe(id)
    await sink.setPendingSession(null)
    expect(await sink.getPendingSession()).toBeNull()
  })
})
