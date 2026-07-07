import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { TEST_SESSION_CONFIG, makeTestAttempt } from '../telemetry/sinkTestFixtures'
import { DexieSink } from './DexieSink'
import { DEFAULT_PROFILE_ID, OpenFoldDB, dailyStatsKey, type DailyStatsRow } from './db'
import { accuracyPerSession, difficultyProgression, latencySeries } from './queries'

describe('persistence integration: restart cycles', () => {
  it('50 close/reopen cycles against the same database name preserve every session and attempt', async () => {
    const dbName = 'persistence-restart-test'

    for (let cycle = 0; cycle < 50; cycle++) {
      const db = new OpenFoldDB(dbName)
      const sink = new DexieSink(db, DEFAULT_PROFILE_ID)

      const id = await sink.openSession(TEST_SESSION_CONFIG)
      await sink.recordAttempt(makeTestAttempt(id, 0))
      await sink.recordAttempt(makeTestAttempt(id, 1))
      await sink.closeSession(id, 'completed', { attempts: 2, correct: 2, accuracy: 1, meanResponseMs: 1000, medianResponseMs: 1000 })

      db.close() // simulates the page/app reloading between rounds
    }

    const verify = new OpenFoldDB(dbName)
    const sessions = await verify.sessions.where('profileId').equals(DEFAULT_PROFILE_ID).toArray()
    const attempts = await verify.attempts.toArray()

    expect(sessions).toHaveLength(50)
    expect(attempts).toHaveLength(100)
    expect(sessions.every((s) => s.outcome === 'completed')).toBe(true)
    verify.close()
  })

  it('a session opened in one cycle and closed in the next survives the restart in between', async () => {
    const dbName = 'persistence-restart-crossing-test'

    const first = new OpenFoldDB(dbName)
    const sink1 = new DexieSink(first, DEFAULT_PROFILE_ID)
    const id = await sink1.openSession(TEST_SESSION_CONFIG)
    await sink1.recordAttempt(makeTestAttempt(id, 0))
    first.close() // "crash" mid-round, before closeSession

    const second = new OpenFoldDB(dbName)
    const pending = await second.settings.get(DEFAULT_PROFILE_ID)
    expect(pending?.pendingSessionId).toBe(id) // reconciliation (App boot) would close this as aborted

    const attempts = await second.attempts.where('sessionId').equals(id).toArray()
    expect(attempts).toHaveLength(1) // the attempt recorded before the "crash" was not lost
    second.close()
  })
})

describe('persistence integration: 10k-attempt aggregate query performance', () => {
  it('latencySeries/accuracyPerSession/difficultyProgression stay under 500ms against a 10k-attempt-equivalent dailyStats fixture', async () => {
    const db = new OpenFoldDB('persistence-perf-test')
    const now = new Date(2026, 6, 7).getTime()
    const dayMs = 24 * 60 * 60 * 1000

    // 10,000 attempts spread across ~400 days x 3 difficulties, materialized the way DexieSink
    // would incrementally build it -- one bulk insert here stands in for thousands of individual
    // incremental writes, since the read path only ever touches dailyStats either way.
    const days = 400
    const perDayPerDifficulty = Math.ceil(10_000 / (days * 3))
    const rows: DailyStatsRow[] = []
    for (let d = 0; d < days; d++) {
      const date = new Date(now - d * dayMs).toISOString().slice(0, 10)
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        rows.push({
          key: dailyStatsKey(DEFAULT_PROFILE_ID, date, difficulty),
          profileId: DEFAULT_PROFILE_ID,
          date,
          difficulty,
          attempts: perDayPerDifficulty,
          correct: Math.floor(perDayPerDifficulty * 0.7),
          latencySumMs: perDayPerDifficulty * 1200,
          latencyCount: perDayPerDifficulty,
        })
      }
    }
    await db.dailyStats.bulkAdd(rows)

    const sessions = Array.from({ length: 500 }, (_, i) => ({
      id: `perf-session-${i}`,
      profileId: DEFAULT_PROFILE_ID,
      startedAt: now - i * dayMs,
      finishedAt: now - i * dayMs + 1000,
      outcome: 'completed' as const,
      config: { difficulty: 'medium' as const, problemCount: 10, timeLimitMs: 30_000, mode: 'fold' as const, sessionSeed: i },
      summary: { attempts: 10, correct: 7, accuracy: 0.7, meanResponseMs: 1000, medianResponseMs: 950 },
    }))
    await db.sessions.bulkAdd(sessions)

    for (const range of ['7d', '30d', '90d', 'all'] as const) {
      const start = performance.now()
      await Promise.all([latencySeries(db, DEFAULT_PROFILE_ID, range, now), accuracyPerSession(db, DEFAULT_PROFILE_ID, range, now), difficultyProgression(db, DEFAULT_PROFILE_ID, range, now)])
      const elapsed = performance.now() - start
      expect(elapsed).toBeLessThan(500)
    }

    db.close()
  })
})
