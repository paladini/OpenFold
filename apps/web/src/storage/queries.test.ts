import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import type { AttemptRow, DailyStatsRow, SessionRow } from './db'
import { DEFAULT_PROFILE_ID, OpenFoldDB, dailyStatsKey, localDateKey, openDb } from './db'
import { accuracyPerSession, difficultyProgression, latencySeries, sessionDetail, sessionList } from './queries'

const NOW = new Date(2026, 6, 7, 12, 0).getTime() // 2026-07-07, matches "today" for these fixtures

function daysAgo(n: number): number {
  return NOW - n * 24 * 60 * 60 * 1000
}

let dbCounter = 0
async function freshDb(): Promise<OpenFoldDB> {
  dbCounter += 1
  return openDb(new OpenFoldDB(`queries-test-${dbCounter}`))
}

function makeDailyStats(profileId: string, date: string, difficulty: DailyStatsRow['difficulty'], overrides: Partial<DailyStatsRow> = {}): DailyStatsRow {
  return { key: dailyStatsKey(profileId, date, difficulty), profileId, date, difficulty, attempts: 1, correct: 1, latencySumMs: 1000, latencyCount: 1, ...overrides }
}

function makeSession(id: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    startedAt: NOW,
    finishedAt: NOW + 1000,
    outcome: 'completed',
    config: { difficulty: 'medium', problemCount: 5, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
    summary: { attempts: 5, correct: 4, accuracy: 0.8, meanResponseMs: 1000, medianResponseMs: 900 },
    ...overrides,
  }
}

describe('latencySeries', () => {
  it('computes mean response time per date/difficulty from dailyStats only', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy', { latencySumMs: 3000, latencyCount: 3 }),
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-02', 'hard', { latencySumMs: 4000, latencyCount: 2 }),
    ])
    const series = await latencySeries(db, DEFAULT_PROFILE_ID, 'all', NOW)
    expect(series).toEqual([
      { date: '2026-07-01', difficulty: 'easy', meanResponseMs: 1000 },
      { date: '2026-07-02', difficulty: 'hard', meanResponseMs: 2000 },
    ])
  })

  it('omits rows with zero latencyCount (all attempts that day were suspect/timeout)', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy', { latencySumMs: 0, latencyCount: 0 })])
    expect(await latencySeries(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([])
  })

  it.each([
    ['7d', 8, 7],
    ['30d', 8, 30],
    ['90d', 8, 90],
  ] as const)('range %s includes only the last N days of a 90-day-back fixture', async (range, sampleEveryNDays, expectedMaxAgeDays) => {
    const db = await freshDb()
    const rows: DailyStatsRow[] = []
    for (let age = 0; age <= 95; age += sampleEveryNDays) {
      rows.push(makeDailyStats(DEFAULT_PROFILE_ID, localDateKey(daysAgo(age)), 'easy'))
    }
    await db.dailyStats.bulkAdd(rows)

    const series = await latencySeries(db, DEFAULT_PROFILE_ID, range, NOW)
    const cutoff = localDateKey(daysAgo(expectedMaxAgeDays))
    expect(series.every((p) => p.date >= cutoff)).toBe(true)
    expect(series.length).toBeGreaterThan(0)
    expect(series.some((p) => p.date < cutoff)).toBe(false)
  })

  it("range 'all' returns every row regardless of age", async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([makeDailyStats(DEFAULT_PROFILE_ID, localDateKey(daysAgo(500)), 'easy')])
    expect(await latencySeries(db, DEFAULT_PROFILE_ID, 'all', NOW)).toHaveLength(1)
  })

  it('never scans the attempts table (dailyStats-only, independent of history size)', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy')])
    const spy = vi.spyOn(db.attempts, 'toArray')
    const whereSpy = vi.spyOn(db.attempts, 'where')
    await latencySeries(db, DEFAULT_PROFILE_ID, 'all', NOW)
    expect(spy).not.toHaveBeenCalled()
    expect(whereSpy).not.toHaveBeenCalled()
  })

  it('empty DB returns an empty array, not null/undefined', async () => {
    const db = await freshDb()
    expect(await latencySeries(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([])
  })
})

describe('accuracyPerSession', () => {
  it('includes only completed sessions with a summary, chronologically', async () => {
    const db = await freshDb()
    await db.sessions.bulkAdd([
      makeSession('s1', { startedAt: daysAgo(3), summary: { attempts: 5, correct: 5, accuracy: 1, meanResponseMs: 1000, medianResponseMs: 1000 } }),
      makeSession('s2', { startedAt: daysAgo(1), summary: { attempts: 5, correct: 3, accuracy: 0.6, meanResponseMs: 1000, medianResponseMs: 1000 } }),
      makeSession('s3', { startedAt: daysAgo(2), outcome: 'aborted', summary: { attempts: 2, correct: 1, accuracy: 0.5, meanResponseMs: 1000, medianResponseMs: 1000 } }),
      makeSession('s4', { startedAt: daysAgo(2), outcome: 'completed', summary: null }),
    ])
    const points = await accuracyPerSession(db, DEFAULT_PROFILE_ID, 'all', NOW)
    expect(points.map((p) => p.sessionId)).toEqual(['s1', 's2'])
    expect(points.map((p) => p.accuracy)).toEqual([1, 0.6])
  })

  it('computes a trailing rolling mean over up to 5 sessions', async () => {
    const db = await freshDb()
    const accuracies = [1, 0.8, 0.6, 0.4, 0.2, 1]
    await db.sessions.bulkAdd(
      accuracies.map((accuracy, i) =>
        makeSession(`s${i}`, { startedAt: daysAgo(10 - i), summary: { attempts: 5, correct: Math.round(accuracy * 5), accuracy, meanResponseMs: 1000, medianResponseMs: 1000 } }),
      ),
    )
    const points = await accuracyPerSession(db, DEFAULT_PROFILE_ID, 'all', NOW)
    // 6th point's window is sessions 2..6 (5-wide): mean of [0.8,0.6,0.4,0.2,1]
    expect(points[5]?.rollingMeanAccuracy).toBeCloseTo((0.8 + 0.6 + 0.4 + 0.2 + 1) / 5, 10)
    // 1st point's window is just itself
    expect(points[0]?.rollingMeanAccuracy).toBe(1)
  })

  it('respects the range filter on startedAt', async () => {
    const db = await freshDb()
    await db.sessions.bulkAdd([makeSession('old', { startedAt: daysAgo(60) }), makeSession('recent', { startedAt: daysAgo(1) })])
    const points = await accuracyPerSession(db, DEFAULT_PROFILE_ID, '7d', NOW)
    expect(points.map((p) => p.sessionId)).toEqual(['recent'])
  })

  it('empty DB returns an empty array', async () => {
    const db = await freshDb()
    expect(await accuracyPerSession(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([])
  })
})

describe('difficultyProgression', () => {
  it('picks the highest tier with >= 5 attempts that day', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy', { attempts: 10 }),
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'hard', { attempts: 3 }), // below threshold
    ])
    expect(await difficultyProgression(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([{ date: '2026-07-01', difficulty: 'easy' }])
  })

  it('breaks ties toward the higher tier when multiple tiers qualify the same day', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy', { attempts: 20 }),
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'medium', { attempts: 5 }),
      makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'hard', { attempts: 5 }),
    ])
    expect(await difficultyProgression(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([{ date: '2026-07-01', difficulty: 'hard' }])
  })

  it('omits days where no tier reaches the threshold', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([makeDailyStats(DEFAULT_PROFILE_ID, '2026-07-01', 'easy', { attempts: 4 })])
    expect(await difficultyProgression(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([])
  })

  it('respects the range filter and sorts chronologically', async () => {
    const db = await freshDb()
    await db.dailyStats.bulkAdd([
      makeDailyStats(DEFAULT_PROFILE_ID, localDateKey(daysAgo(60)), 'hard', { attempts: 10 }),
      makeDailyStats(DEFAULT_PROFILE_ID, localDateKey(daysAgo(2)), 'easy', { attempts: 10 }),
      makeDailyStats(DEFAULT_PROFILE_ID, localDateKey(daysAgo(1)), 'medium', { attempts: 10 }),
    ])
    const points = await difficultyProgression(db, DEFAULT_PROFILE_ID, '7d', NOW)
    expect(points.map((p) => p.difficulty)).toEqual(['easy', 'medium'])
  })

  it('empty DB returns an empty array', async () => {
    const db = await freshDb()
    expect(await difficultyProgression(db, DEFAULT_PROFILE_ID, 'all', NOW)).toEqual([])
  })
})

describe('sessionList', () => {
  it('lists sessions newest-first', async () => {
    const db = await freshDb()
    await db.sessions.bulkAdd([makeSession('old', { startedAt: daysAgo(5) }), makeSession('new', { startedAt: daysAgo(1) })])
    const list = await sessionList(db, DEFAULT_PROFILE_ID, { limit: 10, offset: 0 })
    expect(list.map((s) => s.id)).toEqual(['new', 'old'])
  })

  it('paginates via limit/offset', async () => {
    const db = await freshDb()
    await db.sessions.bulkAdd([makeSession('a', { startedAt: daysAgo(1) }), makeSession('b', { startedAt: daysAgo(2) }), makeSession('c', { startedAt: daysAgo(3) })])
    expect((await sessionList(db, DEFAULT_PROFILE_ID, { limit: 1, offset: 1 })).map((s) => s.id)).toEqual(['b'])
  })

  it('excludes zero-attempt aborted sessions (discarded, per spec edge case)', async () => {
    const db = await freshDb()
    await db.sessions.bulkAdd([makeSession('discarded', { outcome: 'aborted', summary: null }), makeSession('kept', { outcome: 'aborted', summary: { attempts: 2, correct: 1, accuracy: 0.5, meanResponseMs: 900, medianResponseMs: 900 } })])
    const list = await sessionList(db, DEFAULT_PROFILE_ID, { limit: 10, offset: 0 })
    expect(list.map((s) => s.id)).toEqual(['kept'])
  })

  it('empty DB returns an empty array', async () => {
    const db = await freshDb()
    expect(await sessionList(db, DEFAULT_PROFILE_ID, { limit: 10, offset: 0 })).toEqual([])
  })
})

describe('sessionDetail', () => {
  it('returns the session and its attempts sorted by itemIndex', async () => {
    const db = await freshDb()
    await db.sessions.add(makeSession('s1'))
    const attempts: AttemptRow[] = [
      { id: 'a2', sessionId: 's1', itemIndex: 1, seed: 2, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: NOW },
      { id: 'a1', sessionId: 's1', itemIndex: 0, seed: 1, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 800, answeredAt: NOW },
    ]
    await db.attempts.bulkAdd(attempts)
    const detail = await sessionDetail(db, 's1')
    expect(detail?.session.id).toBe('s1')
    expect(detail?.attempts.map((a) => a.itemIndex)).toEqual([0, 1])
  })

  it('returns null for an unknown session id', async () => {
    const db = await freshDb()
    expect(await sessionDetail(db, 'nope')).toBeNull()
  })
})
