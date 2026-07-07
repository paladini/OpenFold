import type { Difficulty } from '../telemetry/types'
import { DIFFICULTY_ORDER, MIN_ATTEMPTS_FOR_PEAK_DIFFICULTY } from './aggregation'
import { localDateKey, type AttemptRow, type DailyStatsRow, type OpenFoldDB, type SessionRow } from './db'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

const RANGE_DAYS: Record<Exclude<TimeRange, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** Local-calendar-date cutoff (inclusive) for a range, or null for 'all' (no lower bound). */
function rangeCutoff(range: TimeRange, now: number): string | null {
  if (range === 'all') return null
  const days = RANGE_DAYS[range]
  return localDateKey(now - days * 24 * 60 * 60 * 1000)
}

export interface LatencyPoint {
  readonly date: string
  readonly difficulty: Difficulty
  readonly meanResponseMs: number
}

/** Reads only dailyStats (never raw attempts) so cost is independent of history size (spec TELE-02 AC5). */
export async function latencySeries(db: OpenFoldDB, profileId: string, range: TimeRange, now: number = Date.now()): Promise<LatencyPoint[]> {
  const cutoff = rangeCutoff(range, now)
  const rows = await db.dailyStats.where('profileId').equals(profileId).toArray()
  return rows
    .filter((r) => r.latencyCount > 0 && (cutoff === null || r.date >= cutoff))
    .map((r) => ({ date: r.date, difficulty: r.difficulty, meanResponseMs: r.latencySumMs / r.latencyCount }))
    .sort((a, b) => (a.date === b.date ? DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty) : a.date < b.date ? -1 : 1))
}

export interface SessionAccuracyPoint {
  readonly sessionId: string
  readonly startedAt: number
  readonly accuracy: number
  readonly rollingMeanAccuracy: number
}

const ROLLING_WINDOW = 5

/** Completed sessions only, chronological, with a trailing rolling-mean accuracy (design: Bar + Line composition). */
export async function accuracyPerSession(db: OpenFoldDB, profileId: string, range: TimeRange, now: number = Date.now()): Promise<SessionAccuracyPoint[]> {
  const cutoff = rangeCutoff(range, now)
  const cutoffMs = cutoff === null ? null : new Date(`${cutoff}T00:00:00`).getTime()
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray()
  const completed = sessions
    .filter((s): s is SessionRow & { summary: NonNullable<SessionRow['summary']> } => s.outcome === 'completed' && s.summary !== null)
    .filter((s) => cutoffMs === null || s.startedAt >= cutoffMs)
    .sort((a, b) => a.startedAt - b.startedAt)

  const points: SessionAccuracyPoint[] = []
  for (let i = 0; i < completed.length; i++) {
    const window = completed.slice(Math.max(0, i - ROLLING_WINDOW + 1), i + 1)
    const rollingMeanAccuracy = window.reduce((sum, s) => sum + s.summary.accuracy, 0) / window.length
    const session = completed[i] as SessionRow & { summary: NonNullable<SessionRow['summary']> }
    points.push({ sessionId: session.id, startedAt: session.startedAt, accuracy: session.summary.accuracy, rollingMeanAccuracy })
  }
  return points
}

export interface DifficultyProgressionPoint {
  readonly date: string
  readonly difficulty: Difficulty
}

/** Highest tier with >= MIN_ATTEMPTS_FOR_PEAK_DIFFICULTY attempts per day; days with no qualifying tier are omitted. */
export async function difficultyProgression(db: OpenFoldDB, profileId: string, range: TimeRange, now: number = Date.now()): Promise<DifficultyProgressionPoint[]> {
  const cutoff = rangeCutoff(range, now)
  const rows = await db.dailyStats.where('profileId').equals(profileId).toArray()
  const byDate = new Map<string, DailyStatsRow[]>()
  for (const r of rows) {
    if (cutoff !== null && r.date < cutoff) continue
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }

  const points: DifficultyProgressionPoint[] = []
  for (const [date, dayRows] of byDate.entries()) {
    const qualifying = dayRows.filter((r) => r.attempts >= MIN_ATTEMPTS_FOR_PEAK_DIFFICULTY)
    if (qualifying.length === 0) continue
    const peak = qualifying.reduce((best, r) => (DIFFICULTY_ORDER.indexOf(r.difficulty) > DIFFICULTY_ORDER.indexOf(best.difficulty) ? r : best))
    points.push({ date, difficulty: peak.difficulty })
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface SessionListItem {
  readonly id: string
  readonly startedAt: number
  readonly finishedAt: number | null
  readonly outcome: SessionRow['outcome']
  readonly difficulty: Difficulty
  readonly problemCount: number
  readonly accuracy: number | null
}

/** Newest-first, paginated. Zero-attempt aborted sessions are excluded (spec edge case: discarded, never shown). */
export async function sessionList(db: OpenFoldDB, profileId: string, page: { readonly limit: number; readonly offset: number }): Promise<SessionListItem[]> {
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray()
  return sessions
    .filter((s) => !(s.outcome === 'aborted' && s.summary === null))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(page.offset, page.offset + page.limit)
    .map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      outcome: s.outcome,
      difficulty: s.config.difficulty,
      problemCount: s.config.problemCount,
      accuracy: s.summary?.accuracy ?? null,
    }))
}

export interface SessionDetail {
  readonly session: SessionRow
  readonly attempts: readonly AttemptRow[]
}

export async function sessionDetail(db: OpenFoldDB, sessionId: string): Promise<SessionDetail | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const attempts = (await db.attempts.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.itemIndex - b.itemIndex)
  return { session, attempts }
}
