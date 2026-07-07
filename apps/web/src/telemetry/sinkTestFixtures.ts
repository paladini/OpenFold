import type { AttemptRecord, SessionConfig, SessionSummary } from './types'

export const TEST_SESSION_CONFIG: SessionConfig = {
  difficulty: 'medium',
  problemCount: 5,
  timeLimitMs: 30_000,
  mode: 'fold',
  sessionSeed: 1,
}

export function makeTestAttempt(sessionId: string, itemIndex: number, overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  return {
    sessionId,
    itemIndex,
    seed: itemIndex,
    mode: 'fold',
    difficulty: 'medium',
    chosenIndex: 0,
    correctIndex: 0,
    correct: true,
    timedOut: false,
    suspect: false,
    responseMs: 1200,
    answeredAt: Date.now(),
    ...overrides,
  }
}

export const TEST_SESSION_SUMMARY: SessionSummary = { attempts: 3, correct: 2, accuracy: 2 / 3, meanResponseMs: 1000, medianResponseMs: 900 }
