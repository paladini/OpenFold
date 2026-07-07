import { describe, expect, it } from 'vitest'
import { hasRotationalSymmetry, repeatRotated, rotatePoint, rotateSubPath, type SubPath } from './glyphPath'

describe('rotatePoint', () => {
  it('rotates (1,0) by 90 degrees to (0,1)', () => {
    const r = rotatePoint({ x: 1, y: 0 }, 90)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(1)
  })

  it('rotating by 360 degrees is the identity', () => {
    const p = { x: 0.3, y: 0.7 }
    const r = rotatePoint(p, 360)
    expect(r.x).toBeCloseTo(p.x)
    expect(r.y).toBeCloseTo(p.y)
  })
})

describe('rotateSubPath', () => {
  it('rotates every point in the path', () => {
    const path: SubPath = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]
    const r = rotateSubPath(path, 90)
    expect(r[0]?.x).toBeCloseTo(0)
    expect(r[0]?.y).toBeCloseTo(1)
    expect(r[1]?.x).toBeCloseTo(-1)
    expect(r[1]?.y).toBeCloseTo(0)
  })
})

describe('repeatRotated', () => {
  const base: SubPath = [
    { x: 0.1, y: 0 },
    { x: 0.5, y: 0.2 },
  ]

  it('produces copies*basePaths.length subpaths', () => {
    const result = repeatRotated([base], 4)
    expect(result).toHaveLength(4)
  })

  it('[PBT via construction] the result is exactly n-fold rotationally symmetric', () => {
    for (const n of [2, 3, 4, 8]) {
      const result = repeatRotated([base], n)
      expect(hasRotationalSymmetry(result, n)).toBe(true)
    }
  })

  it('a single un-rotated base path is NOT symmetric under a finer rotation than it was built with', () => {
    // A single motif with no repetition is generically asymmetric.
    expect(hasRotationalSymmetry([base], 4)).toBe(false)
  })
})

describe('hasRotationalSymmetry', () => {
  it('a single point at the origin is trivially symmetric under any n (rotating it is a no-op)', () => {
    const origin: SubPath = [{ x: 0, y: 0 }]
    expect(hasRotationalSymmetry([origin], 4)).toBe(true)
  })
})
