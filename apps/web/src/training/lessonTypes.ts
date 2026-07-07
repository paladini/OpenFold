import type { DecoratedNet, Rng } from '@openfold/core'
import type { AnchorKey, HighlightTarget } from '@openfold/render'

/**
 * Copy is computed fresh from the actual net every time it's needed -- this is what guarantees
 * lesson/explanation text can never hallucinate geometry: templates can only say what the
 * heuristics API actually returned for this specific procedural net.
 */
export type TextTemplate = (net: DecoratedNet) => string

export interface JustificationView {
  readonly text: string
  readonly highlights: readonly HighlightTarget[]
}

export interface PracticeQuestion {
  readonly prompt: string
  readonly options: readonly string[]
  readonly correctIndex: number
  justify(): JustificationView
}

export interface ResolvedCalloutDecl {
  readonly anchor: AnchorKey
  readonly text: TextTemplate
}

export interface ExpositionStep {
  readonly kind: 'exposition'
  readonly foldProgress: number
  readonly highlights: readonly HighlightTarget[]
  readonly callouts: readonly ResolvedCalloutDecl[]
}

export interface PracticeStep {
  readonly kind: 'practice'
  readonly prompt: TextTemplate
  makeQuestion(net: DecoratedNet): PracticeQuestion
  readonly justification: 'oppositePairs' | 'orientationTrace'
}

export type LessonStep = ExpositionStep | PracticeStep

export interface LessonScript {
  readonly id: string
  readonly title: string
  readonly estMinutes: number
  /** Procedural per lesson run -- content never hardcodes geometry (design: makeProblem(rng)). */
  makeProblem(rng: Rng): DecoratedNet
  /**
   * Highlight/callout targets need real FaceIds from the actual generated net (a hinge between
   * face 2 and face 5 doesn't exist as a fixed fact -- it depends on which net this run drew), so
   * the step list is built from the net rather than declared statically. For a given net this is
   * still a pure, deterministic list -- indexing into it is still a pure function of step index,
   * which is what backward navigation relies on.
   */
  buildSteps(net: DecoratedNet): readonly LessonStep[]
}
