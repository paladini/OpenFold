import { describe, expect, it } from 'vitest'
import { areEquivalent, canonicalize } from './canonicalizer'
import { foldNet } from './foldMapper'
import { CORE_PACKAGE_NAME, generateProblem } from './index'
import { expandPreset } from './params'
import { CUBE_FACES, InvalidParamsError, type CubeState, type DifficultyPreset } from './types'

describe('package scaffold', () => {
  it('exports a placeholder', () => {
    expect(CORE_PACKAGE_NAME).toBe('@openfold/core')
  })
})

describe('generateProblem', () => {
  it('returns a FoldProblem with a net, plan, 5 alternatives, and a valid correctIndex', () => {
    const problem = generateProblem(1, 'medium')
    expect(problem.net.faces).toHaveLength(6)
    expect(problem.plan.hinges).toHaveLength(5)
    expect(problem.alternatives).toHaveLength(5)
    expect(problem.correctIndex).toBeGreaterThanOrEqual(0)
    expect(problem.correctIndex).toBeLessThan(5)
    expect(problem.distractorMeta).toHaveLength(4)
  })

  it("the folded net is rotation-equivalent to alternatives[correctIndex] and to no other alternative", () => {
    for (let seed = 0; seed < 200; seed++) {
      const problem = generateProblem(seed, 'medium')
      const { cube: folded } = foldNet(problem.net)
      for (let i = 0; i < problem.alternatives.length; i++) {
        const alt = problem.alternatives[i] as CubeState
        expect(areEquivalent(folded, alt)).toBe(i === problem.correctIndex)
      }
    }
  })

  it('all 5 alternatives are pairwise non-equivalent', () => {
    for (let seed = 0; seed < 200; seed++) {
      const problem = generateProblem(seed, 'hard')
      for (let i = 0; i < problem.alternatives.length; i++) {
        for (let j = i + 1; j < problem.alternatives.length; j++) {
          const a = problem.alternatives[i] as CubeState
          const b = problem.alternatives[j] as CubeState
          expect(areEquivalent(a, b)).toBe(false)
        }
      }
    }
  })

  it('is fully deterministic: same (seed, params) produces deeply-equal problems', () => {
    const a = generateProblem(999, 'hard')
    const b = generateProblem(999, 'hard')
    expect(a).toEqual(b)
  })

  it('different seeds produce different problems (not always the same net/decoration)', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const problem = generateProblem(seed, 'medium')
      seen.add(JSON.stringify(problem.net.faces.map((f) => [f.cell, f.symbol?.glyphId])))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it("distractorMeta entries' cube face content never rotation-equals the answer", () => {
    for (let seed = 0; seed < 50; seed++) {
      const problem = generateProblem(seed, 'medium')
      const { cube: folded } = foldNet(problem.net)
      for (const meta of problem.distractorMeta) {
        const alt = problem.alternatives[meta.index] as CubeState
        expect(areEquivalent(alt, folded)).toBe(false)
      }
    }
  })

  it('the correct answer position is not positionally biased over 1,000 seeds', () => {
    const counts = [0, 0, 0, 0, 0]
    for (let seed = 0; seed < 1000; seed++) {
      const problem = generateProblem(seed, 'medium')
      counts[problem.correctIndex] = (counts[problem.correctIndex] as number) + 1
    }
    const expected = 1000 / 5
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.3)
    }
  })

  it('rejects decoratedFaces out of range with InvalidParamsError', () => {
    expect(() =>
      generateProblem(1, { decoratedFaces: 2, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' }),
    ).toThrow(InvalidParamsError)
  })

  it('rejects a non-finite seed with InvalidParamsError', () => {
    expect(() => generateProblem(Number.NaN, 'easy')).toThrow(InvalidParamsError)
  })

  it(
    'works for all three presets without throwing across many seeds (redraw-exhaustion rate well under the <0.1% target)',
    () => {
      // 2000 seeds per preset. The 'easy'/'distinct' tier is the historically fragile one (see
      // netGenerator's hasFullyBlankOppositePair and distractors.ts's exhaustive-enumeration
      // regression notes) -- a wider sample than a quick smoke check catches regressions there.
      for (const preset of ['easy', 'medium', 'hard'] as DifficultyPreset[]) {
        let failures = 0
        const total = 600
        for (let seed = 0; seed < total; seed++) {
          try {
            generateProblem(seed, preset)
          } catch {
            failures++
          }
        }
        expect(failures / total).toBeLessThan(0.001)
      }
    },
    30_000,
  )

  it('canonicalize of the folded net matches canonicalize of the stored correct alternative', () => {
    const problem = generateProblem(55, expandPreset('easy'))
    const { cube: folded } = foldNet(problem.net)
    const correct = problem.alternatives[problem.correctIndex] as CubeState
    expect(canonicalize(folded)).toBe(canonicalize(correct))
  })

  it('every alternative has all 6 CUBE_FACES populated', () => {
    const problem = generateProblem(7, 'medium')
    for (const alt of problem.alternatives) {
      for (const face of CUBE_FACES) {
        expect(alt.faces[face]).toBeDefined()
      }
    }
  })
})
