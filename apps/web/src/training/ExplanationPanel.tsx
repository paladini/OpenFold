import type { ProblemScene } from '@openfold/render'
import { useEffect, useMemo } from 'react'
import type { CompletedItem, RoundItem } from '../round/roundMachine'
import { buildExplanation, type AttemptOutcome } from './explanationText'

export interface ExplanationPanelProps {
  readonly item: RoundItem
  readonly result: CompletedItem
  readonly scene: ProblemScene | null
}

const HIGHLIGHT_COLOR = 0x3b82f6

function outcomeOf(result: CompletedItem): AttemptOutcome {
  if (result.timedOut) return 'timeout'
  return result.correct ? 'correct' : 'incorrect'
}

/**
 * Mounted in game-rounds' FeedbackSlot. Fold-mode items only -- unfold-mode items have no
 * distractorMeta to explain against (core.generateUnfoldProblem's alternatives are candidate nets,
 * not perturbation distractors), so this renders nothing for them.
 */
export function ExplanationPanel({ item, result, scene }: ExplanationPanelProps): JSX.Element | null {
  const outcome = outcomeOf(result)
  const explanation = useMemo(
    () => (item.mode === 'fold' ? buildExplanation(item.problem, result.chosenIndex, outcome) : null),
    [item, result.chosenIndex, outcome],
  )

  useEffect(() => {
    if (!scene || !explanation) return
    scene.highlight(explanation.highlights, { color: HIGHLIGHT_COLOR })
    return () => scene.anchors?.clearHighlight()
  }, [scene, explanation])

  if (!explanation) return null

  return (
    <div>
      <p>
        <strong>{explanation.headline}</strong>
      </p>
      <p>{explanation.body}</p>
    </div>
  )
}
