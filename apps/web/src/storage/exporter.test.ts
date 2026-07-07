import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE_ID, OpenFoldDB, openDb, rebuildDailyStats, type AttemptRow, type SessionRow } from './db'
import { exportAll, ImportValidationError, importFile } from './exporter'

let dbCounter = 0
function nextDbName(): string {
  dbCounter += 1
  return `exporter-test-${dbCounter}`
}

function makeSession(id: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    startedAt: 1000,
    finishedAt: 2000,
    outcome: 'completed',
    config: { difficulty: 'medium', problemCount: 2, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
    summary: { attempts: 2, correct: 2, accuracy: 1, meanResponseMs: 900, medianResponseMs: 900 },
    ...overrides,
  }
}

function makeAttempt(id: string, sessionId: string, itemIndex: number): AttemptRow {
  return { id, sessionId, itemIndex, seed: itemIndex, mode: 'fold', difficulty: 'medium', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 900, answeredAt: 1500 }
}

// exporter itself never populates dailyStats -- DexieSink does that on the write path in
// production. For these fixtures, rebuildDailyStats mirrors that after seeding attempts directly.
async function seededDb(): Promise<OpenFoldDB> {
  const db = await openDb(new OpenFoldDB(nextDbName()))
  await db.sessions.add(makeSession('s1'))
  await db.attempts.bulkAdd([makeAttempt('a1', 's1', 0), makeAttempt('a2', 's1', 1)])
  await rebuildDailyStats(db, DEFAULT_PROFILE_ID)
  return db
}

describe('exportAll', () => {
  it('produces a JSON blob with the versioned envelope and current rows', async () => {
    const db = await seededDb()
    const blob = await exportAll(db)
    const data = JSON.parse(await blob.text())
    expect(data.format).toBe('openfold-export')
    expect(data.version).toBe(1)
    expect(data.sessions).toHaveLength(1)
    expect(data.attempts).toHaveLength(2)
    expect(data.profiles).toHaveLength(1)
    expect(data.settings).toHaveLength(1)
  })

  it('never includes dailyStats in the envelope (derivable, always rebuilt on import)', async () => {
    const db = await seededDb()
    const data = JSON.parse(await (await exportAll(db)).text())
    expect(data.dailyStats).toBeUndefined()
  })
})

describe('importFile', () => {
  it('round-trips: export -> wipe -> import restores equivalent sessions/attempts, with dailyStats rebuilt', async () => {
    const source = await seededDb()
    const blob = await exportAll(source)

    const target = await openDb(new OpenFoldDB(nextDbName()))
    const result = await importFile(target, blob)

    expect(result.added).toEqual({ profiles: 0, sessions: 1, attempts: 2, settings: 0 }) // default profile/settings already exist from openDb
    const sessions = await target.sessions.toArray()
    const attempts = await target.attempts.toArray()
    expect(sessions).toEqual(await source.sessions.toArray())
    expect(attempts.sort((a, b) => a.id.localeCompare(b.id))).toEqual((await source.attempts.toArray()).sort((a, b) => a.id.localeCompare(b.id)))

    const stats = await target.dailyStats.toArray()
    expect(stats.reduce((sum, r) => sum + r.attempts, 0)).toBe(2)
  })

  it('re-importing the same file a second time adds nothing and skips everything', async () => {
    const source = await seededDb()
    const blob = await exportAll(source)
    const target = await openDb(new OpenFoldDB(nextDbName()))

    await importFile(target, blob)
    const second = await importFile(target, blob)

    expect(second.added).toEqual({ profiles: 0, sessions: 0, attempts: 0, settings: 0 })
    expect(second.skipped.sessions).toBe(1)
    expect(second.skipped.attempts).toBe(2)
  })

  it('rejects a file that is not valid JSON, before any write', async () => {
    const target = await openDb(new OpenFoldDB(nextDbName()))
    await expect(importFile(target, new Blob(['not json']))).rejects.toThrow(ImportValidationError)
    expect(await target.sessions.count()).toBe(0)
  })

  it('rejects an envelope with the wrong format tag', async () => {
    const target = await openDb(new OpenFoldDB(nextDbName()))
    const bad = new Blob([JSON.stringify({ format: 'something-else', version: 1, profiles: [], sessions: [], attempts: [], settings: [] })])
    await expect(importFile(target, bad)).rejects.toThrow(ImportValidationError)
  })

  it('rejects a newer, unsupported export version, before any write', async () => {
    const target = await openDb(new OpenFoldDB(nextDbName()))
    const newer = new Blob([JSON.stringify({ format: 'openfold-export', version: 2, profiles: [], sessions: [makeSession('should-not-import')], attempts: [], settings: [] })])
    await expect(importFile(target, newer)).rejects.toThrow(ImportValidationError)
    expect(await target.sessions.count()).toBe(0)
  })

  it('rejects an envelope missing a required array', async () => {
    const target = await openDb(new OpenFoldDB(nextDbName()))
    const malformed = new Blob([JSON.stringify({ format: 'openfold-export', version: 1, profiles: [], sessions: [], attempts: [] })])
    await expect(importFile(target, malformed)).rejects.toThrow(ImportValidationError)
  })

  it('merges by id: importing a file with one new and one already-present session reports both counts', async () => {
    const target = await openDb(new OpenFoldDB(nextDbName()))
    await target.sessions.add(makeSession('existing'))
    const envelope = new Blob([
      JSON.stringify({ format: 'openfold-export', version: 1, exportedAt: 1, profiles: [], sessions: [makeSession('existing'), makeSession('fresh')], attempts: [], settings: [] }),
    ])
    const result = await importFile(target, envelope)
    expect(result.added.sessions).toBe(1)
    expect(result.skipped.sessions).toBe(1)
    expect(await target.sessions.count()).toBe(2)
  })
})
