import { explainDistractor, oppositePairs, orientationTrace, type CubeFace, type FaceId, type FoldProblem, type PerturbationKind } from '@openfold/core'
import type { AnchorKey, HighlightTarget } from '@openfold/render'

export type AttemptOutcome = 'correct' | 'incorrect' | 'timeout'

export interface Explanation {
  readonly rule: 'opposition' | 'orientation' | null
  readonly headline: string
  readonly body: string
  readonly highlights: readonly HighlightTarget[]
  readonly anchors: ReadonlyArray<{ readonly key: AnchorKey; readonly label: string }>
}

const ORIENTATION_KINDS: ReadonlySet<PerturbationKind> = new Set(['symbol-rotation', 'symbol-mirror'])

function faceLabel(faceId: FaceId): string {
  return `face ${faceId}`
}

function netHighlight(faceId: FaceId): HighlightTarget {
  return { kind: 'face', id: String(faceId) }
}

function cubeHighlight(optionIndex: number, cubeFace: CubeFace): HighlightTarget {
  return { kind: 'cubeFace', id: `${optionIndex}:face:${cubeFace}` }
}

function faceAnchor(faceId: FaceId): { key: AnchorKey; label: string } {
  return { key: `face:${faceId}` as AnchorKey, label: faceLabel(faceId) }
}

/** Picks the "hardest" rule among an item's distractors -- orientation reasoning beats opposition when both are present. */
function dominantRule(problem: FoldProblem): 'opposition' | 'orientation' {
  return problem.distractorMeta.some((m) => ORIENTATION_KINDS.has(m.kind)) ? 'orientation' : 'opposition'
}

function witnessCubeHighlights(problem: FoldProblem, optionIndex: number, witnessFaces: readonly FaceId[]): HighlightTarget[] {
  return witnessFaces.map((f) => cubeHighlight(optionIndex, problem.plan.faceAssignment[f]))
}

function buildOppositeSwapBody(problem: FoldProblem, witnessFaces: readonly FaceId[]): string {
  const [a, b] = witnessFaces as [FaceId, FaceId]
  const pair = oppositePairs(problem.net).find((p) => (p.faces[0] === a && p.faces[1] === b) || (p.faces[0] === b && p.faces[1] === a))
  const syntactic = pair?.syntactic ?? false
  if (syntactic) {
    return `${faceLabel(a)} and ${faceLabel(b)} sit two cells apart in a straight strip of the net -- that pattern always means they land on opposite cube faces, so they can never share an edge. This cube has them adjacent instead.`
  }
  return `Fold the net and check: ${faceLabel(a)} and ${faceLabel(b)} end up opposite on the cube, so they can never share an edge. This cube has them adjacent instead.`
}

function buildAdjacentPermutationBody(witnessFaces: readonly FaceId[]): string {
  const labels = witnessFaces.map(faceLabel).join(', ')
  return `${labels} meet at one corner of the cube but keep their own separate positions there -- they never swap places with each other. This cube cyclically permutes them, which folding can never do.`
}

function buildSymbolRotationBody(problem: FoldProblem, witnessFace: FaceId): string {
  const trace = orientationTrace(problem.net, witnessFace)
  const foldCount = trace.length
  return `Each 90-degree fold carries ${faceLabel(witnessFace)}'s symbol along with it. Retracing all ${foldCount} fold${foldCount === 1 ? '' : 's'} from the net gives a different final orientation than this cube shows.`
}

function buildSymbolMirrorBody(witnessFace: FaceId): string {
  return `Folding a face never mirrors its symbol -- only rotates it. This cube shows ${faceLabel(witnessFace)}'s symbol mirrored, which folding alone can never produce.`
}

function buildIncorrectExplanation(problem: FoldProblem, chosen: number): Explanation {
  const meta = problem.distractorMeta.find((m) => m.index === chosen)
  if (!meta) {
    return { rule: null, headline: 'Incorrect', body: 'This alternative does not match the net.', highlights: [], anchors: [] }
  }

  const distractor = { cube: problem.alternatives[chosen] as FoldProblem['alternatives'][number], kind: meta.kind, affectedFaces: meta.affectedFaces }
  const { rule, witnessFaces } = explainDistractor(problem.net, distractor)

  const body =
    meta.kind === 'opposite-swap'
      ? buildOppositeSwapBody(problem, witnessFaces)
      : meta.kind === 'adjacent-permutation'
        ? buildAdjacentPermutationBody(witnessFaces)
        : meta.kind === 'symbol-rotation'
          ? buildSymbolRotationBody(problem, witnessFaces[0] as FaceId)
          : buildSymbolMirrorBody(witnessFaces[0] as FaceId)

  return {
    rule,
    headline: rule === 'opposition' ? 'Opposition Rule' : 'Orientation Rule',
    body,
    highlights: [...witnessFaces.map(netHighlight), ...witnessCubeHighlights(problem, chosen, witnessFaces)],
    anchors: witnessFaces.map(faceAnchor),
  }
}

function buildCorrectExplanation(problem: FoldProblem): Explanation {
  const rule = dominantRule(problem)
  return {
    rule,
    headline: 'Correct',
    body:
      rule === 'orientation'
        ? 'Nice work verifying symbol orientation through the folds -- the Orientation Rule was the key check here.'
        : 'Nice work spotting which faces had to be opposite -- the Opposition Rule was the key check here.',
    highlights: [],
    anchors: [],
  }
}

function buildTimeoutExplanation(problem: FoldProblem): Explanation {
  const rule = dominantRule(problem)
  return {
    rule,
    headline: "Time's up",
    body:
      rule === 'orientation'
        ? 'Trace each symbol through its folds from the net to the cube -- that Orientation Rule check would have found the answer faster.'
        : 'Check which net faces must land opposite each other -- that Opposition Rule shortcut would have found the answer faster.',
    // No specific witness faces for a timeout (no wrong choice to explain) -- the correct cube
    // highlight alone points the learner at the right answer.
    highlights: [cubeHighlight(problem.correctIndex, '+z')],
    anchors: [],
  }
}

export function buildExplanation(problem: FoldProblem, chosen: number | null, outcome: AttemptOutcome): Explanation {
  if (outcome === 'correct') return buildCorrectExplanation(problem)
  if (outcome === 'timeout') return buildTimeoutExplanation(problem)
  return buildIncorrectExplanation(problem, chosen as number)
}
