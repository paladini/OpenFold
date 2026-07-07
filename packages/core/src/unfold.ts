import { areEquivalent } from './canonicalizer'
import { foldNet } from './foldMapper'
import { generateNet } from './netGenerator'
import { resolveParams, validateSeed } from './params'
import { createRng } from './prng'
import { GenerationError, type CubeState, type DecoratedNet, type DifficultyPreset, type GenerationParams } from './types'

export interface UnfoldProblem {
  readonly seed: number
  readonly params: GenerationParams
  /** The cube shown as the question. */
  readonly questionCube: CubeState
  /** 5 candidate nets; exactly netAlternatives[correctIndex] folds to something rotation-equivalent to questionCube. */
  readonly netAlternatives: readonly DecoratedNet[]
  readonly correctIndex: number
}

const MAX_REDRAWS = 8
const MAX_CANDIDATE_ATTEMPTS = 8

/**
 * The inverse of generateProblem: shown a folded cube, pick the net that folds into it. Reuses
 * netGenerator/foldMapper/canonicalizer directly rather than duplicating any geometry logic --
 * candidate nets are sampled the same way as fold-mode nets, then kept only if their fold is
 * canonically distinct from both the question cube and every already-accepted candidate.
 */
export function generateUnfoldProblem(seed: number, paramsOrPreset: GenerationParams | DifficultyPreset): UnfoldProblem {
  validateSeed(seed)
  const params = resolveParams(paramsOrPreset)
  const rootRng = createRng(seed)

  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    const attemptRng = rootRng.fork(`attempt-${attempt}`)
    const correctNet = generateNet(attemptRng.fork('question-net'), params)
    const { cube: questionCube } = foldNet(correctNet)

    const candidateNets: DecoratedNet[] = [correctNet]
    const candidateCubes: CubeState[] = [questionCube]
    let exhausted = false

    for (let slot = 0; slot < 4; slot++) {
      let found = false
      for (let candidateAttempt = 0; candidateAttempt < MAX_CANDIDATE_ATTEMPTS; candidateAttempt++) {
        const candidateNet = generateNet(attemptRng.fork(`candidate-${slot}-${candidateAttempt}`), params)
        const { cube: candidateCube } = foldNet(candidateNet)
        if (candidateCubes.some((c) => areEquivalent(c, candidateCube))) continue
        candidateNets.push(candidateNet)
        candidateCubes.push(candidateCube)
        found = true
        break
      }
      if (!found) {
        exhausted = true
        break
      }
    }
    if (exhausted) continue

    const order = [0, 1, 2, 3, 4]
    const shuffleRng = attemptRng.fork('shuffle')
    for (let i = order.length - 1; i > 0; i--) {
      const j = shuffleRng.int(i + 1)
      const tmp = order[i] as number
      order[i] = order[j] as number
      order[j] = tmp
    }
    const netAlternatives = order.map((idx) => candidateNets[idx] as DecoratedNet)
    const correctIndex = order.indexOf(0)

    return { seed, params, questionCube, netAlternatives, correctIndex }
  }

  throw new GenerationError(`generateUnfoldProblem: exhausted ${MAX_REDRAWS} redraw attempts for seed ${seed}`)
}
