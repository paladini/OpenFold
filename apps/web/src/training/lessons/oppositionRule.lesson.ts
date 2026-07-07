import { generateNet, oppositePairs, type DecoratedNet, type FaceId, type GenerationParams, type Rng } from '@openfold/core'
import type { LessonScript, LessonStep } from '../lessonTypes'

const PARAMS: GenerationParams = { decoratedFaces: 4, symbolTier: 'distinct', distractorMix: 'balanced', netBias: 'uniform' }
const MAX_ATTEMPTS = 32

interface SyntacticPair {
  readonly a: FaceId
  readonly b: FaceId
  readonly between: FaceId
}

/**
 * Finds a syntactic Opposition Rule pair (two faces two cells apart in a straight net strip, with
 * the face between them occupied) and the face sitting between them. Pure function of the net --
 * always returns the same result for the same net, so lesson content and the player agree without
 * needing to pass extra state around.
 */
function findSyntacticPair(net: DecoratedNet): SyntacticPair | null {
  const cellByFaceId = new Map(net.faces.map((f) => [f.id, f.cell]))
  for (const pair of oppositePairs(net)) {
    if (!pair.syntactic) continue
    const [a, b] = pair.faces
    const cellA = cellByFaceId.get(a)
    const cellB = cellByFaceId.get(b)
    if (!cellA || !cellB) continue
    const midpoint: readonly [number, number] = cellA[0] === cellB[0] ? [cellA[0], (cellA[1] + cellB[1]) / 2] : [(cellA[0] + cellB[0]) / 2, cellA[1]]
    const between = net.faces.find((f) => f.cell[0] === midpoint[0] && f.cell[1] === midpoint[1])
    if (between) return { a, b, between: between.id }
  }
  return null
}

function makeProblem(rng: Rng): DecoratedNet {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const net = generateNet(rng.fork(`attempt-${attempt}`), PARAMS)
    if (findSyntacticPair(net)) return net
  }
  throw new Error(`oppositionRule.lesson: exhausted ${MAX_ATTEMPTS} attempts finding a syntactic strip pattern`)
}

/** Every net drawn by makeProblem has a syntactic pair (that's the search criterion), so this never returns null in practice. */
function requirePair(net: DecoratedNet): SyntacticPair {
  const pair = findSyntacticPair(net)
  if (!pair) throw new Error('oppositionRule.lesson: net has no syntactic pair (should be unreachable -- makeProblem guarantees one)')
  return pair
}

function buildSteps(net: DecoratedNet): readonly LessonStep[] {
  const { a, b, between } = requirePair(net)
  const patternHighlights = [
    { kind: 'face' as const, id: String(a) },
    { kind: 'face' as const, id: String(b) },
    { kind: 'face' as const, id: String(between) },
  ]
  const pairHighlights = [
    { kind: 'face' as const, id: String(a) },
    { kind: 'face' as const, id: String(b) },
  ]

  return [
    {
      kind: 'exposition',
      foldProgress: 0,
      highlights: patternHighlights,
      callouts: [
        { anchor: `face:${a}`, text: () => `Face ${a} and face ${b} sit two cells apart, with face ${between} in between.` },
        { anchor: `face:${between}`, text: () => `Whenever that pattern occurs in a straight strip, the two outer faces always end up opposite once folded.` },
      ],
    },
    {
      kind: 'exposition',
      foldProgress: 0.5,
      highlights: pairHighlights,
      callouts: [{ anchor: `face:${a}`, text: () => `Watch face ${a} and face ${b} as the net folds -- they are moving toward opposite sides of the cube.` }],
    },
    {
      kind: 'exposition',
      foldProgress: 1,
      highlights: pairHighlights,
      callouts: [
        {
          anchor: `face:${a}`,
          text: () => `Opposition Rule: two faces separated by exactly one face in a straight net strip always land on opposite cube faces -- they can never share an edge.`,
        },
      ],
    },
    {
      kind: 'practice',
      prompt: () => `Which face is opposite face ${a}?`,
      makeQuestion: (n) => {
        const { a: qa, b: qb } = requirePair(n)
        const otherFaces = n.faces.map((f) => f.id).filter((id) => id !== qa)
        const options = otherFaces.map((id) => `Face ${id}`)
        const correctIndex = otherFaces.indexOf(qb)
        return {
          prompt: `Which face is opposite face ${qa}?`,
          options,
          correctIndex,
          justify: () => ({
            text: `Face ${qa} and face ${qb} are two cells apart in a straight strip (face ${findSyntacticPair(n)?.between} between them), so the Opposition Rule places them on opposite cube faces.`,
            highlights: [
              { kind: 'face', id: String(qa) },
              { kind: 'face', id: String(qb) },
            ],
          }),
        }
      },
      justification: 'oppositePairs',
    },
  ]
}

export const lesson: LessonScript = {
  id: 'opposition-rule',
  title: 'The Opposition Rule',
  estMinutes: 3,
  makeProblem,
  buildSteps,
}
