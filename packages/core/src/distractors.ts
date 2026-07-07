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
    super('generateDistractors: exhausted every candidate perturbation without producing 4 valid distractors')
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

interface Candidate {
  readonly cube: CubeState
  readonly affectedFaces: CubeFace[]
}

function withFace(cube: CubeState, face: CubeFace, state: CubeFaceState): CubeState {
  return { faces: { ...cube.faces, [face]: state } }
}

/**
 * Enumerate every opposite-swap candidate (one per axis pair with at least one decorated face).
 * Tests whether the learner verifies WHICH specific face gets which content, not just that two
 * glyphs end up opposite.
 */
function enumerateOppositeSwap(cube: CubeState): Candidate[] {
  const out: Candidate[] = []
  for (const [a, b] of OPPOSITE_PAIRS) {
    const stateA = cube.faces[a]
    const stateB = cube.faces[b]
    if (stateA.glyphId === null && stateB.glyphId === null) continue
    out.push({ cube: withFace(withFace(cube, a, stateB), b, stateA), affectedFaces: [a, b] })
  }
  return out
}

/**
 * Enumerate every adjacent-permutation candidate: both cyclic directions of all 8 corners.
 *
 * Subtlety worth documenting (found via exhaustion failures in generateProblem's test suite, not
 * a hypothetical): cycling the 3 faces at ONE corner is mathematically identical to a genuine
 * 120-degree rotation of the whole cube about that corner's diagonal, whenever the OPPOSITE
 * corner's 3 faces look the same before and after that same rotation (e.g. all blank, or all the
 * same 4-fold glyph -- the common case for a sparsely-decorated easy-tier cube). In that case the
 * "perturbation" is a no-op in disguise and areEquivalent correctly rejects it. Enumerating both
 * directions of all 8 corners (rather than randomly sampling a handful) guarantees we still find
 * the many OTHER corner cycles that mix faces from both corners and are genuinely distinguishing.
 */
function enumerateAdjacentPermutation(cube: CubeState): Candidate[] {
  const out: Candidate[] = []
  for (const [a, b, c] of CORNER_TRIPLES) {
    const sa = cube.faces[a]
    const sb = cube.faces[b]
    const sc = cube.faces[c]
    if (sa.glyphId === null && sb.glyphId === null && sc.glyphId === null) continue
    out.push({ cube: withFace(withFace(withFace(cube, a, sb), b, sc), c, sa), affectedFaces: [a, b, c] })
    out.push({ cube: withFace(withFace(withFace(cube, a, sc), b, sa), c, sb), affectedFaces: [a, b, c] })
  }
  return out
}

/** Faces where a rotation or mirror change is actually visible (excludes blank and 4-fold faces). */
function orientationEligibleFaces(cube: CubeState): CubeFace[] {
  return CUBE_FACES.filter((f) => {
    const s = cube.faces[f]
    return s.glyphId !== null && s.symmetry !== '4-fold'
  })
}

function enumerateSymbolRotation(cube: CubeState): Candidate[] {
  const out: Candidate[] = []
  for (const face of orientationEligibleFaces(cube)) {
    const state = cube.faces[face]
    const period = state.symmetry === '2-fold' ? 180 : 360
    for (const r of ROTATION_CHOICES) {
      if (r % period === state.rotation % period) continue
      out.push({ cube: withFace(cube, face, { ...state, rotation: r }), affectedFaces: [face] })
    }
  }
  return out
}

function enumerateSymbolMirror(cube: CubeState): Candidate[] {
  return orientationEligibleFaces(cube).map((face) => {
    const state = cube.faces[face]
    return { cube: withFace(cube, face, { ...state, mirrored: !state.mirrored }), affectedFaces: [face] }
  })
}

const ENUMERATORS: Readonly<Record<PerturbationKind, (cube: CubeState) => Candidate[]>> = {
  'opposite-swap': enumerateOppositeSwap,
  'adjacent-permutation': enumerateAdjacentPermutation,
  'symbol-rotation': enumerateSymbolRotation,
  'symbol-mirror': enumerateSymbolMirror,
}

const ALL_KINDS: readonly PerturbationKind[] = ['opposite-swap', 'adjacent-permutation', 'symbol-rotation', 'symbol-mirror']

/**
 * The 4-slot desired-kind sequence per difficulty mix. 'structural' aims for >=3
 * opposite-swap/adjacent-permutation distractors (spec PROC-04 AC4, easy); 'subtle' aims for >=2
 * symbol-rotation/symbol-mirror (same AC, hard). If a desired kind's candidate list is empty or
 * fully exhausted for this cube, the slot falls back to another kind -- which for the 'distinct'
 * (4-fold-only) tier only ever falls back to a structural kind, reinforcing rather than violating
 * the structural target.
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

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const tmp = arr[i] as T
    arr[i] = arr[j] as T
    arr[j] = tmp
  }
  return arr
}

/**
 * Generates exactly 4 distractors by exhaustively enumerating each perturbation kind's (small,
 * fully bounded) candidate space -- at most 3 opposite-swaps, 16 adjacent-permutations, and a
 * handful of symbol-rotation/mirror candidates per eligible face -- shuffled for seed-derived
 * variety, then walked in order until a non-equivalent, non-duplicate candidate is found. This
 * guarantees a valid distractor is found whenever one exists in that kind's candidate space,
 * rather than hoping a bounded number of random samples happens to land on one.
 */
export function generateDistractors(answer: CubeState, rng: Rng, params: GenerationParams): Distractor[] {
  const desiredSequence = sequenceForMix(params.distractorMix)
  const accepted: Distractor[] = []

  const queues = new Map<PerturbationKind, Candidate[]>(
    ALL_KINDS.map((kind) => [kind, shuffled(ENUMERATORS[kind](answer), rng.fork(`queue-${kind}`))]),
  )
  const applicableKinds = ALL_KINDS.filter((kind) => (queues.get(kind) as Candidate[]).length > 0)
  if (applicableKinds.length === 0) throw new DistractorExhaustionError()

  for (let slot = 0; slot < 4; slot++) {
    const desiredKind = desiredSequence[slot] as PerturbationKind
    const rest = applicableKinds.filter((k) => k !== desiredKind)
    const kindOrder = applicableKinds.includes(desiredKind) ? [desiredKind, ...rest] : rest
    let acceptedThisSlot = false

    for (const kind of kindOrder) {
      if (acceptedThisSlot) break
      const queue = queues.get(kind) as Candidate[]
      while (queue.length > 0) {
        const candidate = queue.shift() as Candidate
        if (areEquivalent(candidate.cube, answer)) continue
        if (accepted.some((d) => areEquivalent(d.cube, candidate.cube))) continue
        accepted.push({ cube: candidate.cube, kind, affectedFaces: candidate.affectedFaces })
        acceptedThisSlot = true
        break
      }
    }
    if (!acceptedThisSlot) throw new DistractorExhaustionError()
  }

  return accepted
}
