import type { TelemetrySink } from './TelemetrySink'
import type { AttemptRecord, SessionConfig, SessionId, SessionOutcome, SessionSummary } from './types'

interface StoredSession {
  readonly id: SessionId
  readonly config: SessionConfig
  outcome: SessionOutcome | null
  summary: SessionSummary | null
}

export class InMemorySink implements TelemetrySink {
  private sessions = new Map<SessionId, StoredSession>()
  private attemptsBySession = new Map<SessionId, AttemptRecord[]>()
  private pendingSessionId: SessionId | null = null

  async openSession(cfg: SessionConfig): Promise<SessionId> {
    const id = crypto.randomUUID()
    this.sessions.set(id, { id, config: cfg, outcome: null, summary: null })
    this.attemptsBySession.set(id, [])
    await this.setPendingSession(id)
    return id
  }

  async recordAttempt(attempt: AttemptRecord): Promise<void> {
    const attempts = this.attemptsBySession.get(attempt.sessionId)
    if (!attempts) throw new Error(`recordAttempt: unknown session ${attempt.sessionId}`)
    attempts.push(attempt)
    await Promise.resolve()
  }

  async closeSession(id: SessionId, outcome: SessionOutcome, summary: SessionSummary | null): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`closeSession: unknown session ${id}`)
    session.outcome = outcome
    session.summary = summary
    if (this.pendingSessionId === id) {
      await this.setPendingSession(null)
    }
  }

  async getPendingSession(): Promise<SessionId | null> {
    return Promise.resolve(this.pendingSessionId)
  }

  async setPendingSession(id: SessionId | null): Promise<void> {
    this.pendingSessionId = id
    await Promise.resolve()
  }

  // Test/debug helpers (not part of the TelemetrySink contract).
  getSession(id: SessionId): Readonly<StoredSession> | undefined {
    return this.sessions.get(id)
  }

  getAttempts(id: SessionId): readonly AttemptRecord[] {
    return this.attemptsBySession.get(id) ?? []
  }
}
