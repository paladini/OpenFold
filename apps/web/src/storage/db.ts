import Dexie, { type Table } from 'dexie'
import type { AttemptRecord, Difficulty, SessionConfig, SessionSummary } from '../telemetry/types'

export interface ProfileRow {
  readonly id: string
  readonly name: string
  readonly createdAt: number
}

export interface SessionRow {
  readonly id: string
  readonly profileId: string
  readonly startedAt: number
  readonly finishedAt: number | null
  readonly outcome: 'completed' | 'aborted' | 'failed' | null // null while the session is still open
  readonly config: SessionConfig
  readonly summary: SessionSummary | null
}

export interface AttemptRow extends AttemptRecord {
  readonly id: string
}

export interface DailyStatsRow {
  readonly key: string // `${profileId}:${date}:${difficulty}`
  readonly profileId: string
  readonly date: string // YYYY-MM-DD, local calendar date at write time
  readonly difficulty: Difficulty
  readonly attempts: number
  readonly correct: number
  readonly latencySumMs: number // suspect and timed-out attempts excluded
  readonly latencyCount: number
}

export interface SettingsRow {
  readonly profileId: string
  readonly lastRoundConfig: Omit<SessionConfig, 'sessionSeed'> | null
  readonly uiPrefs: Record<string, unknown>
  readonly pendingSessionId: string | null
}

export const DEFAULT_PROFILE_ID = 'default'

export class OpenFoldDB extends Dexie {
  profiles!: Table<ProfileRow, string>
  sessions!: Table<SessionRow, string>
  attempts!: Table<AttemptRow, string>
  dailyStats!: Table<DailyStatsRow, string>
  settings!: Table<SettingsRow, string>

  constructor(name = 'openfold') {
    super(name)
    this.version(1).stores({
      profiles: 'id',
      sessions: 'id, profileId, startedAt',
      attempts: 'id, sessionId, answeredAt',
      dailyStats: 'key, profileId, date',
      settings: 'profileId',
    })
  }
}

export function dailyStatsKey(profileId: string, date: string, difficulty: Difficulty): string {
  return `${profileId}:${date}:${difficulty}`
}

/** Local calendar date (YYYY-MM-DD) for an epoch-ms timestamp -- never UTC, so DST/timezone shifts never rewrite history (spec edge case). */
export function localDateKey(epochMs: number): string {
  const d = new Date(epochMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Opens the DB and bootstraps the default profile + its settings row on first run (idempotent). */
export async function openDb(db: OpenFoldDB = new OpenFoldDB()): Promise<OpenFoldDB> {
  await db.open()
  const existing = await db.profiles.get(DEFAULT_PROFILE_ID)
  if (!existing) {
    await db.profiles.add({ id: DEFAULT_PROFILE_ID, name: 'Default', createdAt: Date.now() })
    await db.settings.add({ profileId: DEFAULT_PROFILE_ID, lastRoundConfig: null, uiPrefs: {}, pendingSessionId: null })
  }
  return db
}

interface DailyStatsAccumulator {
  attempts: number
  correct: number
  latencySumMs: number
  latencyCount: number
}

/**
 * Recomputes every dailyStats row for a profile from raw attempts. This is the correctness oracle
 * for the incremental writes DexieSink performs on the hot path, and the escape hatch import/
 * migration use instead of trusting persisted aggregates (design: "Import trust model").
 */
export async function rebuildDailyStats(db: OpenFoldDB, profileId: string): Promise<void> {
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray()
  const sessionIds = sessions.map((s) => s.id)
  const attempts = sessionIds.length > 0 ? await db.attempts.where('sessionId').anyOf(sessionIds).toArray() : []

  const acc = new Map<string, DailyStatsAccumulator & { date: string; difficulty: Difficulty }>()
  for (const a of attempts) {
    const date = localDateKey(a.answeredAt)
    const key = dailyStatsKey(profileId, date, a.difficulty)
    let row = acc.get(key)
    if (!row) {
      row = { attempts: 0, correct: 0, latencySumMs: 0, latencyCount: 0, date, difficulty: a.difficulty }
      acc.set(key, row)
    }
    row.attempts += 1
    if (a.correct) row.correct += 1
    if (!a.suspect && !a.timedOut) {
      row.latencySumMs += a.responseMs
      row.latencyCount += 1
    }
  }

  const rows: DailyStatsRow[] = Array.from(acc.entries()).map(([key, v]) => ({ key, profileId, ...v }))

  await db.transaction('rw', db.dailyStats, async () => {
    await db.dailyStats.where('profileId').equals(profileId).delete()
    if (rows.length > 0) await db.dailyStats.bulkPut(rows)
  })
}

/** The shape persisted before profiles/dailyStats/settings existed -- frozen in fixtures/exportV0.json. */
export interface V0Export {
  readonly sessions: ReadonlyArray<Omit<SessionRow, 'profileId'>>
  readonly attempts: readonly AttemptRow[]
}

/**
 * Upgrades a frozen v0 export into current-schema rows (attaching the default profile, and
 * synthesizing its settings row). OpenFoldDB has only ever shipped version 1 -- there is no real
 * prior Dexie version to migrate from yet -- so this exists to prove the upgrade-function pattern
 * future `version(n).upgrade()` migrations will reuse, against a synthetic "pre-v1" shape, before
 * a real migration is ever needed (per tasks.md: "ships the harness ... so the pattern exists").
 */
export function migrateV0Export(v0: V0Export, profileId: string = DEFAULT_PROFILE_ID): { profiles: ProfileRow[]; sessions: SessionRow[]; attempts: AttemptRow[]; settings: SettingsRow[] } {
  return {
    profiles: [{ id: profileId, name: 'Default', createdAt: Date.now() }],
    sessions: v0.sessions.map((s) => ({ ...s, profileId })),
    attempts: [...v0.attempts],
    settings: [{ profileId, lastRoundConfig: null, uiPrefs: {}, pendingSessionId: null }],
  }
}
