import type { TelemetrySink } from '../telemetry/TelemetrySink'
import type { AttemptRecord, SessionConfig, SessionId, SessionOutcome, SessionSummary } from '../telemetry/types'
import { DEFAULT_PROFILE_ID, dailyStatsKey, localDateKey, openDb, OpenFoldDB, type AttemptRow, type DailyStatsRow, type SessionRow } from './db'

type Unsubscribe = () => void

interface BufferedAttempt {
  readonly row: AttemptRow
  readonly profileId: string
}

/**
 * TelemetrySink over OpenFoldDB. Attempt inserts and their dailyStats upsert happen inside one
 * Dexie transaction (atomic: a mid-transaction failure rolls both back). If that transaction
 * itself fails (quota, private-mode), the attempt is buffered in memory and retried on the next
 * write, per game-rounds' error-handling design -- the round stays playable either way.
 */
export class DexieSink implements TelemetrySink {
  private readonly db: OpenFoldDB
  private readonly profileId: string
  private readonly ready: Promise<void>
  private pendingBuffer: BufferedAttempt[] = []
  private warningEmitted = false
  private warningListeners: Array<(message: string) => void> = []

  constructor(db: OpenFoldDB = new OpenFoldDB(), profileId: string = DEFAULT_PROFILE_ID) {
    this.db = db
    this.profileId = profileId
    this.ready = openDb(db).then(() => undefined)
  }

  /** Additional to the TelemetrySink contract: surfaces the one-time buffered-write warning. */
  onWarning(cb: (message: string) => void): Unsubscribe {
    this.warningListeners.push(cb)
    return () => {
      this.warningListeners = this.warningListeners.filter((l) => l !== cb)
    }
  }

  async openSession(cfg: SessionConfig): Promise<SessionId> {
    await this.ready
    await this.flushBuffer()
    const id = crypto.randomUUID()
    const row: SessionRow = { id, profileId: this.profileId, startedAt: Date.now(), finishedAt: null, outcome: null, config: cfg, summary: null }
    await this.db.sessions.add(row)
    await this.setPendingSession(id)
    return id
  }

  async recordAttempt(attempt: AttemptRecord): Promise<void> {
    await this.ready
    await this.flushBuffer()
    const session = await this.db.sessions.get(attempt.sessionId)
    if (!session) throw new Error(`DexieSink.recordAttempt: unknown session ${attempt.sessionId}`)

    const row: AttemptRow = { id: crypto.randomUUID(), ...attempt }
    try {
      await this.writeAttemptRow(row, session.profileId)
    } catch (err) {
      this.pendingBuffer.push({ row, profileId: session.profileId })
      this.emitWarningOnce(err instanceof Error ? err.message : 'telemetry write failed')
    }
  }

  async closeSession(id: SessionId, outcome: SessionOutcome, summary: SessionSummary | null): Promise<void> {
    await this.ready
    const session = await this.db.sessions.get(id)
    if (!session) throw new Error(`DexieSink.closeSession: unknown session ${id}`)
    await this.db.sessions.update(id, { outcome, summary, finishedAt: Date.now() })
    const settings = await this.db.settings.get(session.profileId)
    if (settings?.pendingSessionId === id) await this.setPendingSessionFor(session.profileId, null)
  }

  async getPendingSession(): Promise<SessionId | null> {
    await this.ready
    const settings = await this.db.settings.get(this.profileId)
    return settings?.pendingSessionId ?? null
  }

  async setPendingSession(id: SessionId | null): Promise<void> {
    await this.ready
    await this.setPendingSessionFor(this.profileId, id)
  }

  private async setPendingSessionFor(profileId: string, id: SessionId | null): Promise<void> {
    await this.db.settings.update(profileId, { pendingSessionId: id })
  }

  private async writeAttemptRow(row: AttemptRow, profileId: string): Promise<void> {
    const date = localDateKey(row.answeredAt)
    const key = dailyStatsKey(profileId, date, row.difficulty)
    await this.db.transaction('rw', this.db.attempts, this.db.dailyStats, async () => {
      await this.db.attempts.add(row)
      const existing = await this.db.dailyStats.get(key)
      const excludeFromLatency = row.suspect || row.timedOut
      const next: DailyStatsRow = existing
        ? {
            ...existing,
            attempts: existing.attempts + 1,
            correct: existing.correct + (row.correct ? 1 : 0),
            latencySumMs: existing.latencySumMs + (excludeFromLatency ? 0 : row.responseMs),
            latencyCount: existing.latencyCount + (excludeFromLatency ? 0 : 1),
          }
        : {
            key,
            profileId,
            date,
            difficulty: row.difficulty,
            attempts: 1,
            correct: row.correct ? 1 : 0,
            latencySumMs: excludeFromLatency ? 0 : row.responseMs,
            latencyCount: excludeFromLatency ? 0 : 1,
          }
      await this.db.dailyStats.put(next)
    })
  }

  private async flushBuffer(): Promise<void> {
    if (this.pendingBuffer.length === 0) return
    const remaining: BufferedAttempt[] = []
    for (const buffered of this.pendingBuffer) {
      try {
        await this.writeAttemptRow(buffered.row, buffered.profileId)
      } catch {
        remaining.push(buffered)
      }
    }
    this.pendingBuffer = remaining
  }

  private emitWarningOnce(message: string): void {
    if (this.warningEmitted) return
    this.warningEmitted = true
    for (const listener of this.warningListeners) listener(message)
  }
}
