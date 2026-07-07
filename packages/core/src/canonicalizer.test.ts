import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { areEquivalent, canonicalize } from './canonicalizer'
import { rotateCube } from './cubeGeometry'
import { ROTATIONS_24 } from './intMath'
import type { CubeFace, CubeFaceState, CubeState, Rotation, SymbolSymmetry } from './types'

const FACE_ORDER: CubeFace[] = ['+x', '-x', '+y', '-y', '+z', '-z']

function makeCube(overrides: Partial<Record<CubeFace, Partial<CubeFaceState>>> = {}, glyphs = ['A', 'B', 'C', 'D', 'E', 'F']): CubeState {
  const faces = {} as Record<CubeFace, CubeFaceState>
  FACE_ORDER.forEach((face, i) => {
    faces[face] = {
      glyphId: glyphs[i] ?? null,
      symmetry: 'asymmetric',
      rotation: 0,
      mirrored: false,
      ...overrides[face],
    }
  })
  return { faces }
}

const glyphStateArb = fc.record({
  glyphId: fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'),
  symmetry: fc.constantFrom<SymbolSymmetry>('asymmetric', '2-fold', '4-fold'),
  rotation: fc.constantFrom<Rotation>(0, 90, 180, 270),
  mirrored: fc.boolean(),
})

const cubeArb: fc.Arbitrary<CubeState> = fc
  .tuple(glyphStateArb, glyphStateArb, glyphStateArb, glyphStateArb, glyphStateArb, glyphStateArb)
  .map(([x1, x2, y1, y2, z1, z2]) => ({
    faces: { '+x': x1, '-x': x2, '+y': y1, '-y': y2, '+z': z1, '-z': z2 },
  }))

const rotationArb = fc.integer({ min: 0, max: 23 }).map((i) => ROTATIONS_24[i]!)

describe('canonicalize / areEquivalent', () => {
  it('[PBT] is invariant under rotating the whole cube', () => {
    fc.assert(
      fc.property(cubeArb, rotationArb, (cube, m) => {
        const rotated = rotateCube(cube, m)
        expect(canonicalize(rotated)).toBe(canonicalize(cube))
        expect(areEquivalent(cube, rotated)).toBe(true)
      }),
    )
  })

  it('[PBT] two independently rotated copies of the same cube are always equivalent', () => {
    fc.assert(
      fc.property(cubeArb, rotationArb, rotationArb, (cube, m1, m2) => {
        const a = rotateCube(cube, m1)
        const b = rotateCube(cube, m2)
        expect(areEquivalent(a, b)).toBe(true)
      }),
    )
  })

  it('a cube differing in exactly one asymmetric face rotation (others distinct) is never equivalent', () => {
    const cubeA = makeCube({ '+x': { rotation: 0 } })
    const cubeB = makeCube({ '+x': { rotation: 90 } })
    expect(areEquivalent(cubeA, cubeB)).toBe(false)
  })

  it('a cube differing in exactly one glyph identity (others distinct) is never equivalent', () => {
    const cubeA = makeCube()
    const cubeB = makeCube({}, ['Z', 'B', 'C', 'D', 'E', 'F'])
    expect(areEquivalent(cubeA, cubeB)).toBe(false)
  })

  it('a 2-fold symbol rotated by 180 degrees compares equal (its physical appearance is identical)', () => {
    const cubeA = makeCube({ '+z': { symmetry: '2-fold', rotation: 0 } })
    const cubeB = makeCube({ '+z': { symmetry: '2-fold', rotation: 180 } })
    expect(areEquivalent(cubeA, cubeB)).toBe(true)
  })

  it('a 2-fold symbol rotated by 90 degrees compares different (genuinely distinguishable)', () => {
    const cubeA = makeCube({ '+z': { symmetry: '2-fold', rotation: 0 } })
    const cubeB = makeCube({ '+z': { symmetry: '2-fold', rotation: 90 } })
    expect(areEquivalent(cubeA, cubeB)).toBe(false)
  })

  it('a 4-fold symbol compares equal at every rotation', () => {
    const base = makeCube({ '+z': { symmetry: '4-fold', rotation: 0 } })
    for (const rotation of [90, 180, 270] as const) {
      const other = makeCube({ '+z': { symmetry: '4-fold', rotation } })
      expect(areEquivalent(base, other)).toBe(true)
    }
  })

  it('blank faces (glyphId null) are equivalent regardless of their stored rotation value', () => {
    const cubeA = makeCube({ '+z': { glyphId: null, rotation: 0 } })
    const cubeB = makeCube({ '+z': { glyphId: null, rotation: 270 } })
    expect(areEquivalent(cubeA, cubeB)).toBe(true)
  })

  it('a mirrored asymmetric symbol is never equivalent to its unmirrored original (others distinct)', () => {
    const cubeA = makeCube({ '+z': { mirrored: false } })
    const cubeB = makeCube({ '+z': { mirrored: true } })
    expect(areEquivalent(cubeA, cubeB)).toBe(false)
  })

  it('mirroring is preserved under whole-cube rotation (chirality is rotation-invariant)', () => {
    fc.assert(
      fc.property(rotationArb, (m) => {
        const cube = makeCube({ '+z': { mirrored: true } })
        const rotated = rotateCube(cube, m)
        expect(areEquivalent(cube, rotated)).toBe(true)
      }),
    )
  })

  it('mirroring is ignored for 4-fold symbols (the v1 glyph set is achiral at that symmetry)', () => {
    const cubeA = makeCube({ '+z': { symmetry: '4-fold', mirrored: false } })
    const cubeB = makeCube({ '+z': { symmetry: '4-fold', mirrored: true } })
    expect(areEquivalent(cubeA, cubeB)).toBe(true)
  })

  it('canonicalize is deterministic for the same input', () => {
    const cube = makeCube()
    expect(canonicalize(cube)).toBe(canonicalize(cube))
  })
})
