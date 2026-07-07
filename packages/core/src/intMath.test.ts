import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  applyScrew,
  apply,
  composeScrew,
  determinant,
  equalMat,
  hingeRotation,
  IDENTITY,
  type IMat3,
  type IVec3,
  mul,
  ROTATIONS_24,
  transpose,
} from './intMath'

const axisVectors: IVec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

function matKey(m: IMat3): string {
  return m.flat().join(',')
}

describe('ROTATIONS_24 (cube rotation group)', () => {
  it('has exactly 24 distinct matrices', () => {
    const keys = new Set(ROTATIONS_24.map(matKey))
    expect(keys.size).toBe(24)
  })

  it('every matrix has determinant +1 (proper rotation)', () => {
    for (const m of ROTATIONS_24) {
      expect(determinant(m)).toBe(1)
    }
  })

  it('every matrix maps the 6 axis unit vectors to a permutation of themselves', () => {
    for (const m of ROTATIONS_24) {
      const images = axisVectors.map((v) => apply(m, v))
      for (const img of images) {
        expect(axisVectors.some((a) => a[0] === img[0] && a[1] === img[1] && a[2] === img[2])).toBe(true)
      }
      const uniqueImages = new Set(images.map((v) => v.join(',')))
      expect(uniqueImages.size).toBe(6)
    }
  })

  it('contains the identity', () => {
    expect(ROTATIONS_24.some((m) => equalMat(m, IDENTITY))).toBe(true)
  })

  it('is closed under multiplication (group axiom)', () => {
    const keys = new Set(ROTATIONS_24.map(matKey))
    // Sample pairs rather than the full 24x24 to keep this fast but still meaningful.
    for (let i = 0; i < ROTATIONS_24.length; i++) {
      for (let j = 0; j < ROTATIONS_24.length; j += 3) {
        const a = ROTATIONS_24[i] as IMat3
        const b = ROTATIONS_24[j] as IMat3
        expect(keys.has(matKey(mul(a, b)))).toBe(true)
      }
    }
  })

  it('every matrix has an inverse (its transpose) present in the group', () => {
    const keys = new Set(ROTATIONS_24.map(matKey))
    for (const m of ROTATIONS_24) {
      expect(keys.has(matKey(transpose(m)))).toBe(true)
      expect(equalMat(mul(m, transpose(m)), IDENTITY)).toBe(true)
    }
  })
})

describe('hingeRotation / composeScrew', () => {
  it('rotates a point about the pivot axis correctly (right-neighbor hinge folds +X to +Z)', () => {
    const hinge = hingeRotation('y', [1, 0, 0], -1)
    // A point one unit to the right of the pivot line, at z=0 -> should fold "up" to +Z.
    const p: IVec3 = [2, 5, 0]
    const result = applyScrew(hinge, p)
    expect(result).toEqual([1, 5, 1])
  })

  it('rotates a point about the pivot axis correctly (down-neighbor hinge folds +Y to +Z)', () => {
    const hinge = hingeRotation('x', [0, 1, 0], 1)
    const p: IVec3 = [3, 2, 0]
    const result = applyScrew(hinge, p)
    expect(result).toEqual([3, 1, 1])
  })

  it('composeScrew matches sequential application of the two motions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'x' | 'y'>('x', 'y'),
        fc.constantFrom<1 | -1>(1, -1),
        fc.integer({ min: -3, max: 3 }),
        fc.constantFrom<'x' | 'y'>('x', 'y'),
        fc.constantFrom<1 | -1>(1, -1),
        fc.integer({ min: -3, max: 3 }),
        fc.tuple(fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 })),
        (axisA, signA, pivotA, axisB, signB, pivotB, point) => {
          const pivotVecA: IVec3 = axisA === 'x' ? [0, pivotA, 0] : [pivotA, 0, 0]
          const pivotVecB: IVec3 = axisB === 'x' ? [0, pivotB, 0] : [pivotB, 0, 0]
          const inner = hingeRotation(axisA, pivotVecA, signA)
          const outer = hingeRotation(axisB, pivotVecB, signB)
          const composed = composeScrew(outer, inner)

          const p = point as IVec3
          const sequential = applyScrew(outer, applyScrew(inner, p))
          const direct = applyScrew(composed, p)
          expect(direct).toEqual(sequential)
        },
      ),
    )
  })
})
