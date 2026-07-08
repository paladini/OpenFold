import type { RoundState } from '../round/roundMachine'
import type { SessionConfig } from '../telemetry/types'
import { randomSessionSeed } from './randomSeed'

export interface SummaryScreenProps {
  readonly state: Extract<RoundState, { phase: 'summary' }>
  readonly onRetry: (config: SessionConfig) => void
  readonly onNewRound: () => void
  readonly generateSeed?: () => number
}

function formatAccuracy(accuracy: number): string {
  return `${(accuracy * 100).toFixed(1)}%`
}

function itemLabel(item: { correct: boolean; timedOut: boolean }): string {
  if (item.timedOut) return 'Timeout'
  return item.correct ? 'Correct' : 'Incorrect'
}

export function SummaryScreen({ state, onRetry, onNewRound, generateSeed = randomSessionSeed }: SummaryScreenProps): JSX.Element {
  const { summary, completedItems, config, outcome } = state

  return (
    <div data-testid="results-screen">
      {outcome === 'aborted' && <p role="status">Round aborted -- showing partial results</p>}
      <dl>
        <dt>Accuracy</dt>
        <dd data-testid="accuracy-score">{formatAccuracy(summary.accuracy)}</dd>
        <dt>Correct</dt>
        <dd>
          {summary.correct} / {summary.attempts}
        </dd>
        <dt>Mean response time</dt>
        <dd>{Math.round(summary.meanResponseMs)} ms</dd>
        <dt>Median response time</dt>
        <dd>{Math.round(summary.medianResponseMs)} ms</dd>
      </dl>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Result</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {completedItems.map((item) => (
            <tr key={item.itemIndex}>
              <td>{item.itemIndex + 1}</td>
              <td>{itemLabel(item)}</td>
              <td>{item.timedOut ? '--' : `${item.responseMs} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button type="button" onClick={() => onRetry({ ...config, sessionSeed: generateSeed() })}>
        Retry same settings
      </button>
      <button type="button" onClick={onNewRound}>
        New round
      </button>
    </div>
  )
}
