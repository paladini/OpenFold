export type Difficulty = 'easy' | 'medium' | 'hard'
export type RoundMode = 'fold' | 'unfold' | 'mixed'
export type ItemMode = 'fold' | 'unfold'
export type SessionOutcome = 'completed' | 'aborted' | 'failed'

export interface SessionConfig {
  readonly difficulty: Difficulty
  readonly problemCount: number // 5..50
  readonly timeLimitMs: number | null // 10_000..120_000, or null = unlimited
  readonly mode: RoundMode
  readonly sessionSeed: number
}

export interface AttemptRecord {
  readonly sessionId: string
  readonly itemIndex: number
  readonly seed: number
  readonly mode: ItemMode
  readonly difficulty: Difficulty
  readonly chosenIndex: number | null // null = timeout
  readonly correctIndex: number
  readonly correct: boolean
  readonly timedOut: boolean
  readonly suspect: boolean
  readonly responseMs: number
  readonly answeredAt: number // epoch ms, display only
}

export interface SessionSummary {
  readonly attempts: number
  readonly correct: number
  readonly accuracy: number // 0..1
  readonly meanResponseMs: number
  readonly medianResponseMs: number
}

export type SessionId = string
