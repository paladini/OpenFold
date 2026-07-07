import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { areEquivalent } from './canonicalizer'
import { foldNet } from './foldMapper'
import { expandPreset } from './params'
import { generateUnfoldProblem } from './unfold'
import { InvalidParamsError, type DifficultyPreset } from './types'

describe('generateUnfoldProblem', () => {
  it('[PBT] exactly one of 5 candidate nets folds to a cube rotation-equivalent to the question', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.constantFrom<DifficultyPreset>('easy', 'medium', 'hard'),
        (seed, preset) => {
          const problem = generateUnfoldProblem(seed, preset)
          expect(problem.netAlternatives).toHaveLength(5)

          let matches = 0
          for (let i = 0; i < problem.netAlternatives.length; i++) {
            const net = problem.netAlternatives[i] as (typeof problem.netAlternatives)[number]
            const { cube } = foldNet(net)
            if (areEquivalent(cube, problem.questionCube)) {
              matches++
              expect(i).toBe(problem.correctIndex)
            }
          }
          expect(matches).toBe(1)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('all 5 candidate nets fold to pairwise-distinct cubes', () => {
    for (let seed = 0; seed < 100; seed++) {
      const problem = generateUnfoldProblem(seed, 'medium')
      const cubes = problem.netAlternatives.map((net) => foldNet(net).cube)
      for (let i = 0; i < cubes.length; i++) {
        for (let j = i + 1; j < cubes.length; j++) {
          expect(areEquivalent(cubes[i] as (typeof cubes)[number], cubes[j] as (typeof cubes)[number])).toBe(false)
        }
      }
    }
  })

  it('is deterministic: same (seed, params) produces a deeply-equal problem', () => {
    const a = generateUnfoldProblem(42, 'hard')
    const b = generateUnfoldProblem(42, 'hard')
    expect(a).toEqual(b)
  })

  it('the correct index is not positionally biased over 500 seeds', () => {
    const counts = [0, 0, 0, 0, 0]
    for (let seed = 0; seed < 500; seed++) {
      const problem = generateUnfoldProblem(seed, 'medium')
      counts[problem.correctIndex] = (counts[problem.correctIndex] as number) + 1
    }
    const expected = 500 / 5
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.3)
    }
  })

  it('rejects a non-finite seed with InvalidParamsError', () => {
    expect(() => generateUnfoldProblem(Number.NaN, 'easy')).toThrow(InvalidParamsError)
  })

  it('accepts a custom GenerationParams object as well as a preset name', () => {
    const params = expandPreset('hard')
    expect(() => generateUnfoldProblem(1, params)).not.toThrow()
  })

  it('works across all three presets without throwing over many seeds', () => {
    for (const preset of ['easy', 'medium', 'hard'] as DifficultyPreset[]) {
      for (let seed = 0; seed < 100; seed++) {
        expect(() => generateUnfoldProblem(seed, preset)).not.toThrow()
      }
    }
  })
})
