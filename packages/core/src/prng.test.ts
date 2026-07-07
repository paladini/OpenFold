import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createRng } from './prng'

describe('createRng', () => {
  it('is a known-answer regression guard for seed 42 (guards against algorithm drift)', () => {
    const rng = createRng(42)
    const values = Array.from({ length: 8 }, () => rng.next())
    expect(values).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423,
      0.5265925421845168, 0.2732279943302274, 0.6247446539346129,
    ])
  })

  it('is deterministic: same seed produces the same sequence', () => {
    const a = createRng(1234)
    const b = createRng(1234)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('different seeds produce different sequences', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('next() always returns a value in [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const rng = createRng(seed)
        for (let i = 0; i < 50; i++) {
          const v = rng.next()
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThan(1)
        }
      }),
    )
  })

  it('int(n) is range-correct for n up to 2^16', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 1, max: 2 ** 16 }), (seed, n) => {
        const rng = createRng(seed)
        for (let i = 0; i < 30; i++) {
          const v = rng.int(n)
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThan(n)
        }
      }),
    )
  })

  it('int() throws on non-positive bound', () => {
    const rng = createRng(1)
    expect(() => rng.int(0)).toThrow(RangeError)
    expect(() => rng.int(-1)).toThrow(RangeError)
  })

  it('pick() returns an element of the array', () => {
    const rng = createRng(7)
    const arr = ['a', 'b', 'c', 'd'] as const
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(rng.pick(arr))
    }
  })

  it('pick() throws on an empty array', () => {
    const rng = createRng(1)
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it('fork(label) streams are independent of the parent stream position', () => {
    const parentBefore = createRng(99)
    const parentAfter = createRng(99)

    // Consume some values from parentAfter before forking; the fork must not depend on this.
    parentAfter.next()
    parentAfter.next()
    parentAfter.next()

    const forkFromFresh = parentBefore.fork('net')
    const forkFromConsumed = parentAfter.fork('net')

    expect(forkFromFresh.next()).toBe(forkFromConsumed.next())
  })

  it('fork(label) with different labels yields different streams', () => {
    const parent = createRng(99)
    const forkA = parent.fork('net')
    const forkB = parent.fork('distractors')
    expect(forkA.next()).not.toBe(forkB.next())
  })

  it('forking does not consume from the parent stream', () => {
    const a = createRng(55)
    const b = createRng(55)
    a.fork('x')
    a.fork('y')
    // a and b should still be in lockstep since forking a doesn't touch a's own stream
    expect(a.next()).toBe(b.next())
  })
})
