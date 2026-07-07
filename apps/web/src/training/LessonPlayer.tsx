import { createRng, foldNet, type DecoratedNet, type FoldProblem } from '@openfold/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProblemScene } from '../hooks/useProblemScene'
import { CalloutLayer, type ResolvedCallout } from './CalloutLayer'
import type { LessonScript, PracticeQuestion } from './lessonTypes'

export interface LessonPlayerProps {
  readonly script: LessonScript
  readonly onComplete: () => void
  readonly resumeAt?: number
  /** Deterministic per lesson run; tests pin this. Defaults to a fresh random draw. */
  readonly seed?: number
}

const HIGHLIGHT_COLOR = 0x3b82f6
const CORRECT_COLOR = 0x22c55e
const INCORRECT_COLOR = 0xef4444

/**
 * A full FoldProblem is what ProblemScene's fold-mode mount expects, but a lesson only teaches
 * one net -- the 5 "alternative" cube slots it renders are decorative filler, never referenced by
 * any lesson highlight/callout, so all 5 are simply the same correctly-folded cube.
 */
function buildLessonProblem(net: DecoratedNet, seed: number): FoldProblem {
  const { cube, plan } = foldNet(net)
  return {
    seed,
    params: { decoratedFaces: net.faces.filter((f) => f.symbol !== null).length, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' },
    net,
    plan,
    alternatives: [cube, cube, cube, cube, cube],
    correctIndex: 0,
    distractorMeta: [],
  }
}

interface PracticeState {
  readonly question: PracticeQuestion
  readonly chosen: number | null
}

export function LessonPlayer({ script, onComplete, resumeAt = 0, seed = Math.floor(Math.random() * 2 ** 31) }: LessonPlayerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const net = useMemo(() => script.makeProblem(createRng(seed)), [script, seed])
  const problem = useMemo(() => buildLessonProblem(net, seed), [net, seed])
  const steps = useMemo(() => script.buildSteps(net), [script, net])
  const { scene, error } = useProblemScene(containerRef, problem)

  const [stepIndex, setStepIndex] = useState(resumeAt)
  const [practiceState, setPracticeState] = useState<PracticeState | null>(null)
  const completedRef = useRef(false)

  const step = steps[stepIndex]
  const lastStepIndex = steps.length - 1

  useEffect(() => {
    if (!scene || !step) return
    scene.anchors?.clearHighlight()
    scene.setInteractive(false)
    if (step.kind === 'exposition') {
      scene.setProgress(step.foldProgress)
      if (step.highlights.length > 0) scene.highlight(step.highlights, { color: HIGHLIGHT_COLOR })
      setPracticeState(null)
    } else {
      setPracticeState({ question: step.makeQuestion(net), chosen: null })
    }
  }, [scene, step, net])

  useEffect(() => {
    if (stepIndex === lastStepIndex && !completedRef.current) {
      completedRef.current = true
      onComplete()
    }
  }, [stepIndex, lastStepIndex, onComplete])

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent): void {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  function goNext(): void {
    setStepIndex((i) => Math.min(lastStepIndex, i + 1))
  }

  function goPrev(): void {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  function answerPractice(index: number): void {
    if (!practiceState || practiceState.chosen !== null) return
    setPracticeState({ ...practiceState, chosen: index })
    const justification = practiceState.question.justify()
    scene?.highlight(justification.highlights, { color: index === practiceState.question.correctIndex ? CORRECT_COLOR : INCORRECT_COLOR })
  }

  const resolvedCallouts: ResolvedCallout[] = step?.kind === 'exposition' ? step.callouts.map((c) => ({ anchor: c.anchor, text: c.text(net) })) : []

  return (
    <div>
      <p>
        {script.title} -- step {stepIndex + 1} of {steps.length}
      </p>
      {error && <p role="alert">{error.message}</p>}
      <div style={{ position: 'relative' }}>
        <div ref={containerRef} data-testid="lesson-scene-container" />
        <CalloutLayer scene={scene} callouts={resolvedCallouts} />
      </div>

      {step?.kind === 'exposition' &&
        step.callouts.map((c, i) => (
          <p key={i} data-testid="exposition-text">
            {c.text(net)}
          </p>
        ))}

      {step?.kind === 'practice' && practiceState && (
        <div>
          <p>{step.prompt(net)}</p>
          <div role="group" aria-label="Practice options">
            {practiceState.question.options.map((opt, i) => (
              <button key={opt} type="button" disabled={practiceState.chosen !== null} onClick={() => answerPractice(i)}>
                {opt}
              </button>
            ))}
          </div>
          {practiceState.chosen !== null && (
            <p role="status">
              {practiceState.chosen === practiceState.question.correctIndex ? 'Correct. ' : 'Incorrect. '}
              {practiceState.question.justify().text}
            </p>
          )}
        </div>
      )}

      <button type="button" onClick={goPrev} disabled={stepIndex === 0}>
        Back
      </button>
      <button type="button" onClick={goNext} disabled={stepIndex === lastStepIndex}>
        Next
      </button>
    </div>
  )
}
