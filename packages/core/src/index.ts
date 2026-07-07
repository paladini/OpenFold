import { DistractorExhaustionError, generateDistractors } from './distractors'
import { foldNet } from './foldMapper'
import { generateNet } from './netGenerator'
import { resolveParams, validateSeed } from './params'
import { createRng } from './prng'
import { GenerationError, type CubeState, type DifficultyPreset, type DistractorMeta, type FoldProblem, type GenerationParams } from './types'

export const CORE_PACKAGE_NAME = '@openfold/core'

const MAX_REDRAWS = 8

interface PoolEntry {
  readonly cube: CubeState
  readonly meta: DistractorMeta | null // null marks the correct answer
}

function shuffle<T>(items: readonly T[], rng: { int(n: number): number }): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = arr[i] as T
    arr[i] = arr[j] as T
    arr[j] = tmp
  }
  return arr
}

function buildAlternatives(
  answerCube: CubeState,
  rng: ReturnType<typeof createRng>,
  params: GenerationParams,
): { alternatives: CubeState[]; correctIndex: number; distractorMeta: DistractorMeta[] } | null {
  let distractors: ReturnType<typeof generateDistractors>
  try {
    distractors = generateDistractors(answerCube, rng.fork('distractors'), params)
  } catch (e) {
    if (e instanceof DistractorExhaustionError) return null
    throw e
  }

  const pool: PoolEntry[] = [
    { cube: answerCube, meta: null },
    ...distractors.map((d): PoolEntry => ({ cube: d.cube, meta: { index: -1, kind: d.kind, affectedFaces: d.affectedFaces } })),
  ]
  const shuffled = shuffle(pool, rng.fork('shuffle'))
  const alternatives = shuffled.map((p) => p.cube)
  const correctIndex = shuffled.findIndex((p) => p.meta === null)
  const distractorMeta: DistractorMeta[] = shuffled
    .map((p, i) => (p.meta ? { ...p.meta, index: i } : null))
    .filter((m): m is DistractorMeta => m !== null)

  return { alternatives, correctIndex, distractorMeta }
}

export function generateProblem(seed: number, paramsOrPreset: GenerationParams | DifficultyPreset): FoldProblem {
  validateSeed(seed)
  const params = resolveParams(paramsOrPreset)
  const rootRng = createRng(seed)

  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    const attemptRng = rootRng.fork(`attempt-${attempt}`)
    const net = generateNet(attemptRng.fork('net'), params)
    const { cube: answerCube, plan } = foldNet(net)

    const result = buildAlternatives(answerCube, attemptRng, params)
    if (!result) continue

    return {
      seed,
      params,
      net,
      plan,
      alternatives: result.alternatives,
      correctIndex: result.correctIndex,
      distractorMeta: result.distractorMeta,
    }
  }

  throw new GenerationError(`generateProblem: exhausted ${MAX_REDRAWS} redraw attempts for seed ${seed}`)
}

export * from './types'
export { foldNet } from './foldMapper'
export { generateNet, GLYPH_LIBRARY } from './netGenerator'
export { generateDistractors, DistractorExhaustionError } from './distractors'
export { canonicalize, areEquivalent } from './canonicalizer'
export { oppositePairs, orientationTrace, explainDistractor } from './heuristics'
export { expandPreset, resolveParams, validateParams, validateSeed } from './params'
export { createRng } from './prng'
export type { Rng } from './prng'
export { CANONICAL_NETS, normalizeNet } from './netCatalog'
export type { CanonicalNet } from './netCatalog'
