import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import exportV0 from './fixtures/exportV0.json'
import { DEFAULT_PROFILE_ID, OpenFoldDB, dailyStatsKey, localDateKey, migrateV0Export, openDb, rebuildDailyStats, type AttemptRow, type V0Export } from './db'

let dbCounter = 0
function freshDbName(): string {
  dbCounter += 1
  return `openfold-test-${dbCounter}`
}

describe('OpenFoldDB schema', () => {
  it('stores and indexes match the design exactly', () => {
    const db = new OpenFoldDB(freshDbName())
    const byName = new Map(db.tables.map((t) => [t.name, t]))

    expect(byName.get('profiles')?.schema.primKey.name).toBe('id')
    expect(byName.get('sessions')?.schema.primKey.name).toBe('id')
    expect(byName.get('sessions')?.schema.indexes.map((i) => i.name).sort()).toEqual(['profileId', 'startedAt'])
    expect(byName.get('attempts')?.schema.primKey.name).toBe('id')
    expect(byName.get('attempts')?.schema.indexes.map((i) => i.name).sort()).toEqual(['answeredAt', 'sessionId'])
    expect(byName.get('dailyStats')?.schema.primKey.name).toBe('key')
    expect(byName.get('dailyStats')?.schema.indexes.map((i) => i.name).sort()).toEqual(['date', 'profileId'])
    expect(byName.get('settings')?.schema.primKey.name).toBe('profileId')
    db.close()
  })
})

describe('openDb', () => {
  it('creates the default profile and its settings row on first run', async () => {
    const db = await openDb(new OpenFoldDB(freshDbName()))
    const profile = await db.profiles.get(DEFAULT_PROFILE_ID)
    const settings = await db.settings.get(DEFAULT_PROFILE_ID)
    expect(profile?.name).toBe('Default')
    expect(settings).toEqual({ profileId: DEFAULT_PROFILE_ID, lastRoundConfig: null, uiPrefs: {}, pendingSessionId: null })
    db.close()
  })

  it('is idempotent: a second run does not duplicate or reset the profile', async () => {
    const name = freshDbName()
    const first = await openDb(new OpenFoldDB(name))
    await first.settings.update(DEFAULT_PROFILE_ID, { pendingSessionId: 'was-in-progress' })
    first.close()

    const second = await openDb(new OpenFoldDB(name))
    const profiles = await second.profiles.toArray()
    const settings = await second.settings.get(DEFAULT_PROFILE_ID)
    expect(profiles).toHaveLength(1)
    expect(settings?.pendingSessionId).toBe('was-in-progress') // untouched by the second bootstrap
    second.close()
  })

  it('two concurrent openDb calls against the same database name (e.g. StrictMode double-invoke) do not throw or duplicate the profile', async () => {
    const name = freshDbName()
    const [first, second] = await Promise.all([openDb(new OpenFoldDB(name)), openDb(new OpenFoldDB(name))])
    const profiles = await first.profiles.toArray()
    expect(profiles).toHaveLength(1)
    first.close()
    second.close()
  })
})

describe('localDateKey / dailyStatsKey', () => {
  it('formats a local calendar date as YYYY-MM-DD', () => {
    const d = new Date(2026, 0, 5, 23, 59) // Jan 5 2026, local time
    expect(localDateKey(d.getTime())).toBe('2026-01-05')
  })

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 2, 4, 0, 0)
    expect(localDateKey(d.getTime())).toBe('2026-03-04')
  })

  it('builds the profileId:date:difficulty composite key', () => {
    expect(dailyStatsKey('default', '2026-01-05', 'hard')).toBe('default:2026-01-05:hard')
  })
})

describe('rebuildDailyStats', () => {
  let db: OpenFoldDB

  beforeEach(async () => {
    db = await openDb(new OpenFoldDB(freshDbName()))
  })

  it('produces per-difficulty daily rows, excluding suspect and timed-out attempts from latency', async () => {
    const day = new Date(2026, 5, 1, 10, 0).getTime()
    await db.sessions.add({
      id: 's1',
      profileId: DEFAULT_PROFILE_ID,
      startedAt: day,
      finishedAt: day + 1000,
      outcome: 'completed',
      config: { difficulty: 'easy', problemCount: 4, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
      summary: { attempts: 4, correct: 2, accuracy: 0.5, meanResponseMs: 1000, medianResponseMs: 1000 },
    })
    const attempts: AttemptRow[] = [
      { id: 'a1', sessionId: 's1', itemIndex: 0, seed: 1, mode: 'fold', difficulty: 'easy', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 1000, answeredAt: day },
      { id: 'a2', sessionId: 's1', itemIndex: 1, seed: 2, mode: 'fold', difficulty: 'easy', chosenIndex: 1, correctIndex: 0, correct: false, timedOut: false, suspect: false, responseMs: 2000, answeredAt: day + 1 },
      // suspect: counts toward attempts/correct, excluded from latency
      { id: 'a3', sessionId: 's1', itemIndex: 2, seed: 3, mode: 'fold', difficulty: 'easy', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: true, responseMs: 100, answeredAt: day + 2 },
      // timeout: counts toward attempts, NOT correct, excluded from latency
      { id: 'a4', sessionId: 's1', itemIndex: 3, seed: 4, mode: 'fold', difficulty: 'easy', chosenIndex: null, correctIndex: 0, correct: false, timedOut: true, suspect: false, responseMs: 30_000, answeredAt: day + 3 },
    ]
    await db.attempts.bulkAdd(attempts)

    await rebuildDailyStats(db, DEFAULT_PROFILE_ID)

    const rows = await db.dailyStats.toArray()
    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row?.attempts).toBe(4)
    expect(row?.correct).toBe(2)
    expect(row?.latencyCount).toBe(2) // only a1, a2
    expect(row?.latencySumMs).toBe(3000)
    expect(row?.key).toBe(dailyStatsKey(DEFAULT_PROFILE_ID, localDateKey(day), 'easy'))
  })

  it('splits rows per difficulty even on the same calendar day', async () => {
    const day = new Date(2026, 5, 2, 9, 0).getTime()
    await db.sessions.add({
      id: 's2',
      profileId: DEFAULT_PROFILE_ID,
      startedAt: day,
      finishedAt: day + 1000,
      outcome: 'completed',
      config: { difficulty: 'easy', problemCount: 2, timeLimitMs: null, mode: 'fold', sessionSeed: 1 },
      summary: { attempts: 2, correct: 2, accuracy: 1, meanResponseMs: 900, medianResponseMs: 900 },
    })
    await db.attempts.bulkAdd([
      { id: 'b1', sessionId: 's2', itemIndex: 0, seed: 1, mode: 'fold', difficulty: 'easy', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: day },
      { id: 'b2', sessionId: 's2', itemIndex: 1, seed: 2, mode: 'unfold', difficulty: 'hard', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: day + 1 },
    ] satisfies AttemptRow[])

    await rebuildDailyStats(db, DEFAULT_PROFILE_ID)

    const rows = await db.dailyStats.toArray()
    expect(rows.map((r) => r.difficulty).sort()).toEqual(['easy', 'hard'])
  })

  it('is idempotent and only touches the given profile', async () => {
    await db.profiles.add({ id: 'other', name: 'Other', createdAt: Date.now() })
    await db.dailyStats.add({ key: 'other:2026-01-01:easy', profileId: 'other', date: '2026-01-01', difficulty: 'easy', attempts: 9, correct: 9, latencySumMs: 9000, latencyCount: 9 })

    await rebuildDailyStats(db, DEFAULT_PROFILE_ID)
    await rebuildDailyStats(db, DEFAULT_PROFILE_ID)

    const otherRows = await db.dailyStats.where('profileId').equals('other').toArray()
    expect(otherRows).toHaveLength(1) // untouched by rebuilding a different profile
    const defaultRows = await db.dailyStats.where('profileId').equals(DEFAULT_PROFILE_ID).toArray()
    expect(defaultRows).toHaveLength(0) // no sessions for default profile in this test
  })
})

describe('migration harness: v0 -> current schema', () => {
  it('migrates the frozen v0 fixture losslessly into current rows', async () => {
    const db = await openDb(new OpenFoldDB(freshDbName()))
    const upgraded = migrateV0Export(exportV0 as V0Export)

    await db.sessions.bulkAdd(upgraded.sessions)
    await db.attempts.bulkAdd(upgraded.attempts)
    // profiles/settings already exist from openDb's bootstrap -- migrateV0Export's copies are
    // for a from-scratch import path (exporter T7), not re-asserted here.

    await rebuildDailyStats(db, DEFAULT_PROFILE_ID)

    const sessions = await db.sessions.toArray()
    const attempts = await db.attempts.toArray()
    expect(sessions).toHaveLength(exportV0.sessions.length)
    expect(attempts).toHaveLength(exportV0.attempts.length)
    expect(sessions[0]?.profileId).toBe(DEFAULT_PROFILE_ID)

    const stats = await db.dailyStats.toArray()
    const expectedCorrect = exportV0.attempts.filter((a) => a.correct).length
    expect(stats.reduce((sum, r) => sum + r.correct, 0)).toBe(expectedCorrect)
    expect(stats.reduce((sum, r) => sum + r.attempts, 0)).toBe(exportV0.attempts.length)
    db.close()
  })

  it('assigns the default profile and a fresh settings row when migrating into an empty target', () => {
    const upgraded = migrateV0Export(exportV0 as V0Export)
    expect(upgraded.profiles).toEqual([{ id: DEFAULT_PROFILE_ID, name: 'Default', createdAt: upgraded.profiles[0]?.createdAt }])
    expect(upgraded.settings).toEqual([{ profileId: DEFAULT_PROFILE_ID, lastRoundConfig: null, uiPrefs: {}, pendingSessionId: null }])
    expect(upgraded.sessions.every((s) => s.profileId === DEFAULT_PROFILE_ID)).toBe(true)
  })
})
