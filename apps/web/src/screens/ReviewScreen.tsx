import { generateProblem, generateUnfoldProblem, type FoldProblem, type UnfoldProblem } from '@openfold/core'
import { useEffect, useRef } from 'react'
import { useProblemScene } from '../hooks/useProblemScene'
import type { ItemMode, SessionConfig } from '../telemetry/types'

export interface ReviewRequest {
  readonly seed: number
  readonly config: SessionConfig
  readonly mode: ItemMode
  readonly chosenIndex: number | null
}

export interface ReviewScreenProps {
  readonly request: ReviewRequest
  readonly onClose: () => void
}

function regenerate(request: ReviewRequest): FoldProblem | UnfoldProblem {
  return request.mode === 'fold' ? generateProblem(request.seed, request.config.difficulty) : generateUnfoldProblem(request.seed, request.config.difficulty)
}

export function ReviewScreen({ request, onClose }: ReviewScreenProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const problem = regenerate(request)
  const { scene, error } = useProblemScene(containerRef, problem)

  useEffect(() => {
    if (!scene) return
    scene.setInteractive(false)
    scene.showFeedback(problem.correctIndex, request.chosenIndex ?? -1)
  }, [scene, problem, request.chosenIndex])

  function handleReplay(): void {
    void scene?.playFold()
  }

  return (
    <div>
      <p>
        Review: seed {request.seed} -- {request.mode} -- {request.config.difficulty}
      </p>
      {error && <p role="alert">{error.message}</p>}
      <div ref={containerRef} data-testid="review-scene-container" />
      {request.mode === 'fold' && (
        <button type="button" onClick={handleReplay}>
          Replay fold
        </button>
      )}
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}
