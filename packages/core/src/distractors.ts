import { areEquivalent } from './canonicalizer'
import type { Rng } from './prng'
import {
  CUBE_FACES,
  type CubeFace,
  type CubeFaceState,
  type CubeState,
  type GenerationParams,
  type PerturbationKind,
  type Rotation,
} from './types'

export interface Distractor {
  readonly cube: CubeState
  readonly kind: PerturbationKind
  readonly affectedFaces: readonly CubeFace[]
}

export class DistractorExhaustionError extends Error {
  constructor() {
    super('generateDistractors: exhausted the retry budget without producing 4 valid distractors')
    this.name = 'DistractorExhaustionError'
  }
}

const OPPOSITE_PAIRS: readonly (readonly [CubeFace, CubeFace])[] = [
  ['+x', '-x'],
  ['+y', '-y'],
  ['+z', '-z'],
]

/** The 8 corners of a cube, each touching one face from each axis pair. */
const CORNER_TRIPLES: readonly (readonly [CubeFace, CubeFace, CubeFace])[] = (() => {
  const triples: Array<readonly [CubeFace, CubeFace, CubeFace]> = []
  for (const x of ['+x', '-x'] as const) {
    for (const y of ['+y', '-y'] as const) {
      for (const z of ['+z', '-z'] as const) {
        triples.push([x, y, z])
      }
    }
  }
  return triples
})()

const ROTATION_CHOICES: readonly Rotation[] = [0, 90, 180, 270]

type PerturbResult = { cube: CubeState; affectedFaces: CubeFace[] } | null

function withFace(cube: CubeState, face: CubeFace, state: CubeFaceState): CubeState {
  return { faces: { ...cube.faces, [face]: state } }
}

/**
 * Swap the full content of one of the 3 opposite-axis face pairs. Tests whether the learner
 * verifies WHICH specific face gets which content, not just that two glyphs end up opposite.
 */
function attemptOppositeSwap(cube: CubeState, rng: Rng): PerturbResult {
  const pair = rng.pick(OPPOSITE_PAIRS)
  const [a, b] = pair
  const stateA = cube.faces[a]
  const stateB = cube.faces[b]
  if (stateA.glyphId === null && stateB.glyphId === null) return null
  return { cube: withFace(withFace(cube, a, stateB), b, stateA), affectedFaces: [a, b] }
}

/** Cycle the content of 3 mutually-adjacent faces (meeting at one corner). */
function attemptAdjacentPermutation(cube: CubeState, rng: Rng): PerturbResult {
  const triple = rng.pick(CORNER_TRIPLES)
  const [a, b, c] = triple
  const sa = cube.faces[a]
  const sb = cube.faces[b]
  const sc = cube.faces[c]
  if (sa.glyphId === null && sb.glyphId === null && sc.glyphId === null) return null
  let next = withFace(cube, a, sb)
  next = withFace(next, b, sc)
  next = withFace(next, c, sa)
  return { cube: next, affectedFaces: [a, b, c] }
}

/** Faces where a rotation or mirror change is actually visible (excludes blank and 4-fold faces). */
function orientationEligibleFaces(cube: CubeState): CubeFace[] {
  return CUBE_FACES.filter((f) => {
    const s = cube.faces[f]
    return s.glyphId !== null && s.symmetry !== '4-fold'
  })
}

function attemptSymbolRotation(cube: CubeState, rng: Rng): PerturbResult {
  const eligible = orientationEligibleFaces(cube)
  if (eligible.length === 0) return null
  const face = rng.pick(eligible)
  const state = cube.faces[face]
  const period = state.symmetry === '2-fold' ? 180 : 360
  const candidates = ROTATION_CHOICES.filter((r) => r % period !== state.rotation % period)
  if (candidates.length === 0) return null
  const newRotation = rng.pick(candidates)
  return { cube: withFace(cube, face, { ...state, rotation: newRotation }), affectedFaces: [face] }
}

function attemptSymbolMirror(cube: CubeState, rng: Rng): PerturbResult {
  const eligible = orientationEligibleFaces(cube)
  if (eligible.length === 0) return null
  const face = rng.pick(eligible)
  const state = cube.faces[face]
  return { cube: withFace(cube, face, { ...state, mirrored: !state.mirrored }), affectedFaces: [face] }
}

const PERTURBERS: Readonly<Record<PerturbationKind, (cube: CubeState, rng: Rng) => PerturbResult>> = {
  'opposite-swap': attemptOppositeSwap,
  'adjacent-permutation': attemptAdjacentPermutation,
  'symbol-rotation': attemptSymbolRotation,
  'symbol-mirror': attemptSymbolMirror,
}

const ALL_KINDS: readonly PerturbationKind[] = ['opposite-swap', 'adjacent-permutation', 'symbol-rotation', 'symbol-mirror']

/**
 * The 4-slot desired-kind sequence per difficulty mix. 'structural' aims for >=3
 * opposite-swap/adjacent-permutation distractors (spec PROC-04 AC4, easy); 'subtle' aims for >=2
 * symbol-rotation/symbol-mirror (same AC, hard). If a desired kind is inapplicable to the current
 * cube (e.g. symbol-rotation with an all-4-fold decoration), the slot falls back to another kind
 * -- which for the 'distinct' (4-fold-only) tier only ever falls back to a structural kind,
 * reinforcing rather than violating the structural target.
 */
function sequenceForMix(mix: GenerationParams['distractorMix']): readonly PerturbationKind[] {
  switch (mix) {
    case 'structural':
      return ['opposite-swap', 'adjacent-permutation', 'opposite-swap', 'symbol-rotation']
    case 'balanced':
      return ['opposite-swap', 'symbol-rotation', 'symbol-mirror', 'adjacent-permutation']
    case 'subtle':
      return ['symbol-rotation', 'symbol-mirror', 'symbol-rotation', 'opposite-swap']
  }
}

const MAX_TOTAL_ATTEMPTS = 32
const MAX_ATTEMPTS_PER_KIND = 4

export function generateDistractors(answer: CubeState, rng: Rng, params: GenerationParams): Distractor[] {
  const desiredSequence = sequenceForMix(params.distractorMix)
  const accepted: Distractor[] = []
  let totalAttempts = 0

  for (let slot = 0; slot < 4; slot++) {
    const desiredKind = desiredSequence[slot] as PerturbationKind
    const kindOrder = [desiredKind, ...ALL_KINDS.filter((k) => k !== desiredKind)]
    let acceptedThisSlot = false

    for (const kind of kindOrder) {
      if (acceptedThisSlot) break
      for (let localAttempt = 0; localAttempt < MAX_ATTEMPTS_PER_KIND; localAttempt++) {
        if (totalAttempts >= MAX_TOTAL_ATTEMPTS) throw new DistractorExhaustionError()
        totalAttempts++
        const result = PERTURBERS[kind](answer, rng)
        if (!result) continue
        if (areEquivalent(result.cube, answer)) continue
        if (accepted.some((d) => areEquivalent(d.cube, result.cube))) continue
        accepted.push({ cube: result.cube, kind, affectedFaces: result.affectedFaces })
        acceptedThisSlot = true
        break
      }
    }
    if (!acceptedThisSlot) throw new DistractorExhaustionError()
  }

  return accepted
}
