import type { ProblemScene } from '@openfold/render'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useProblemScene } from '../hooks/useProblemScene'
import type { CompletedItem, RoundItem, RoundState } from '../round/roundMachine'

export interface FeedbackSlotProps {
  readonly item: RoundItem
  readonly result: CompletedItem
  readonly scene: ProblemScene | null
}

export interface PlayScreenProps {
  readonly state: Extract<RoundState, { phase: 'presenting' | 'answering' | 'feedback' }>
  readonly onSceneReady: () => void
  readonly onSelect: (index: number) => void
  readonly onNext: () => void
  readonly onAbort: () => void
  readonly feedbackSlot?: (props: FeedbackSlotProps) => ReactNode
}

const OPTION_COUNT = 5

function formatSeconds(ms: number): string {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`
}

export function PlayScreen({ state, onSceneReady, onSelect, onNext, onAbort, feedbackSlot }: PlayScreenProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scene, error } = useProblemScene(containerRef, state.item.problem)
  const sceneReadyNotified = useRef(false)
  const [remainingMs, setRemainingMs] = useState<number | null>(state.config.timeLimitMs)

  useEffect(() => {
    sceneReadyNotified.current = false
    setRemainingMs(state.config.timeLimitMs)
  }, [state.itemIndex])

  useEffect(() => {
    if (!scene || sceneReadyNotified.current || state.phase !== 'presenting') return
    sceneReadyNotified.current = true
    onSceneReady()
  }, [scene, state.phase])

  useEffect(() => {
    if (state.phase !== 'answering' || state.config.timeLimitMs === null) return
    const deadline = performance.now() + state.config.timeLimitMs
    const id = window.setInterval(() => {
      setRemainingMs(Math.max(0, deadline - performance.now()))
    }, 250)
    return () => window.clearInterval(id)
  }, [state.phase, state.itemIndex, state.config.timeLimitMs])

  useEffect(() => {
    if (state.phase !== 'feedback' || !scene) return
    scene.showFeedback(state.lastResult.correctIndex, state.lastResult.chosenIndex ?? -1)
  }, [state.phase, scene])

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent): void {
      if (state.phase !== 'answering') return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= OPTION_COUNT) onSelect(n - 1)
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [state.phase, onSelect])

  useEffect(() => {
    if (!scene) return
    return scene.onSelect((index) => {
      if (state.phase === 'answering') onSelect(index)
    })
  }, [scene, state.phase, onSelect])

  function handleReplay(): void {
    void scene?.playFold()
  }

  return (
    <div>
      <p>
        Item {state.itemIndex + 1} of {state.config.problemCount}
      </p>
      <p data-testid="round-timer" aria-live="polite">{remainingMs === null ? 'Unlimited time' : `Time left: ${formatSeconds(remainingMs)}`}</p>
      {error && <p role="alert">{error.message}</p>}
      <div ref={containerRef} data-testid="cube-view" />
      {state.phase === 'answering' && (
        <div role="group" aria-label="Answer options">
          {Array.from({ length: OPTION_COUNT }, (_, i) => (
            <button key={i} type="button" data-testid="answer-button" onClick={() => onSelect(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {state.phase === 'feedback' && (
        <div>
          <p data-testid="feedback-message">{state.lastResult.timedOut ? 'Timed out' : state.lastResult.correct ? 'Correct!' : 'Incorrect'}</p>
          {state.item.mode === 'fold' && (
            <button type="button" onClick={handleReplay}>
              Replay fold
            </button>
          )}
          {feedbackSlot?.({ item: state.item, result: state.lastResult, scene })}
          <button type="button" data-testid="next-button" onClick={onNext}>
            Next
          </button>
        </div>
      )}
      <button type="button" data-testid="abort-button" onClick={onAbort}>
        Abort round
      </button>
    </div>
  )
}
