import type { AttemptRecord, SessionConfig, SessionId, SessionOutcome, SessionSummary } from './types'

/**
 * Decouples the round loop from storage. game-rounds ships an InMemorySink for tests and
 * pre-persistence builds; telemetry-analytics implements this over Dexie without the round loop
 * changing at all.
 */
export interface TelemetrySink {
  openSession(cfg: SessionConfig): Promise<SessionId>
  recordAttempt(attempt: AttemptRecord): Promise<void>
  closeSession(id: SessionId, outcome: SessionOutcome, summary: SessionSummary | null): Promise<void>
  getPendingSession(): Promise<SessionId | null>
  setPendingSession(id: SessionId | null): Promise<void>
}
