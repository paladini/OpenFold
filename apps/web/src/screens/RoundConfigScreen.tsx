import { useState, type FormEvent } from 'react'
import { ConfigValidationError, validateSessionConfig } from '../round/roundMachine'
import type { Difficulty, RoundMode, SessionConfig } from '../telemetry/types'
import { randomSessionSeed } from './randomSeed'

export const DEFAULT_ROUND_CONFIG: Omit<SessionConfig, 'sessionSeed'> = {
  difficulty: 'medium',
  problemCount: 10,
  timeLimitMs: 30_000,
  mode: 'fold',
}

export interface RoundConfigScreenProps {
  readonly initialConfig?: Omit<SessionConfig, 'sessionSeed'>
  readonly onStart: (config: SessionConfig) => void
  readonly generateSeed?: () => number
}

export function RoundConfigScreen({ initialConfig, onStart, generateSeed = randomSessionSeed }: RoundConfigScreenProps): JSX.Element {
  const base = initialConfig ?? DEFAULT_ROUND_CONFIG
  const [difficulty, setDifficulty] = useState<Difficulty>(base.difficulty)
  const [problemCount, setProblemCount] = useState(base.problemCount)
  const [unlimited, setUnlimited] = useState(base.timeLimitMs === null)
  const [timeLimitSeconds, setTimeLimitSeconds] = useState((base.timeLimitMs ?? 30_000) / 1000)
  const [mode, setMode] = useState<RoundMode>(base.mode)

  const candidate: SessionConfig = {
    difficulty,
    problemCount,
    timeLimitMs: unlimited ? null : timeLimitSeconds * 1000,
    mode,
    sessionSeed: 0,
  }

  let error: string | null = null
  try {
    validateSessionConfig(candidate)
  } catch (err) {
    error = err instanceof ConfigValidationError ? err.message : 'Invalid configuration'
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    if (error) return
    onStart({ ...candidate, sessionSeed: generateSeed() })
  }

  return (
    <form aria-label="Round configuration" onSubmit={handleSubmit}>
      <label>
        Difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>

      <label>
        Problem count
        <input
          type="number"
          aria-label="Problem count"
          value={problemCount}
          min={5}
          max={50}
          onChange={(e) => setProblemCount(Number(e.target.value))}
        />
      </label>

      <label>
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
        Unlimited time
      </label>

      {!unlimited && (
        <label>
          Time limit (seconds)
          <input
            type="number"
            aria-label="Time limit (seconds)"
            value={timeLimitSeconds}
            min={10}
            max={120}
            onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
          />
        </label>
      )}

      <label>
        Mode
        <select value={mode} onChange={(e) => setMode(e.target.value as RoundMode)}>
          <option value="fold">Fold</option>
          <option value="unfold">Unfold</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={error !== null}>
        Start round
      </button>
    </form>
  )
}
