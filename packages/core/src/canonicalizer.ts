import { rotateCube } from './cubeGeometry'
import { ROTATIONS_24 } from './intMath'
import { CUBE_FACES, type CubeFaceState, type CubeState } from './types'

function normalizedRotation(state: CubeFaceState): number {
  if (state.glyphId === null) return 0
  switch (state.symmetry) {
    case 'asymmetric':
      return state.rotation
    case '2-fold':
      return state.rotation % 180
    case '4-fold':
      return 0
  }
}

/** Mirroring is invariant under rotation (which never flips chirality) -- included as-is, except
 * for null/4-fold faces where the v1 glyph set is achiral by construction. */
function normalizedMirrored(state: CubeFaceState): boolean {
  if (state.glyphId === null || state.symmetry === '4-fold') return false
  return state.mirrored
}

function serialize(cube: CubeState): string {
  return CUBE_FACES.map((face) => {
    const s = cube.faces[face]
    return `${face}:${s.glyphId ?? ''}:${normalizedRotation(s)}:${normalizedMirrored(s)}`
  }).join('|')
}

/**
 * Canonical form under the cube's 24-element rotation group, symbol-symmetry aware: two cubes
 * that are physically the same object (possibly picked up and rotated, and/or differing only by
 * a symbol's own rotational symmetry) always produce the identical canonical string.
 */
export function canonicalize(cube: CubeState): string {
  let best: string | null = null
  for (const m of ROTATIONS_24) {
    const key = serialize(rotateCube(cube, m))
    if (best === null || key < best) best = key
  }
  if (best === null) throw new Error('unreachable: ROTATIONS_24 is never empty')
  return best
}

export function areEquivalent(a: CubeState, b: CubeState): boolean {
  return canonicalize(a) === canonicalize(b)
}
