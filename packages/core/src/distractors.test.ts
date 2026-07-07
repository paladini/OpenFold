import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { areEquivalent } from './canonicalizer'
import { DistractorExhaustionError, generateDistractors } from './distractors'
import { expandPreset } from './params'
import { createRng } from './prng'
import type { CubeFace, CubeFaceState, CubeState, GenerationParams } from './types'

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

const FULLY_BLANK_CUBE: CubeState = makeCube({}, [null, null, null, null, null, null] as unknown as string[])

describe('generateDistractors: basic contract', () => {
  it('returns exactly 4 distractors, each carrying kind and affectedFaces', () => {
    const cube = makeCube()
    const params = expandPreset('medium')
    const distractors = generateDistractors(cube, createRng(1), params)
    expect(distractors).toHaveLength(4)
    for (const d of distractors) {
      expect(d.kind).toBeTruthy()
      expect(d.affectedFaces.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic for a given seed', () => {
    const cube = makeCube()
    const params = expandPreset('medium')
    const a = generateDistractors(cube, createRng(42), params)
    const b = generateDistractors(cube, createRng(42), params)
    expect(a).toEqual(b)
  })

  it('throws DistractorExhaustionError when no perturbation can possibly apply (all-blank cube)', () => {
    const params: GenerationParams = { decoratedFaces: 3, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' }
    expect(() => generateDistractors(FULLY_BLANK_CUBE, createRng(1), params)).toThrow(DistractorExhaustionError)
  })
})

describe('generateDistractors: validity', () => {
  it('[PBT] all 4 distractors are pairwise non-equivalent and none equivalent to the answer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.constantFrom<'easy' | 'medium' | 'hard'>('easy', 'medium', 'hard'),
        (seed, preset) => {
          const params = expandPreset(preset)
          // Build a varied but always-valid answer cube: decorate exactly params.decoratedFaces faces.
          const rng = createRng(seed)
          const glyphPool =
            params.symbolTier === 'distinct' ? ['circle-dot', 'plus-ring', 'square-ring', 'diamond-ring'] : ['arrow', 'flag', 'l-shape', 'bowtie', 'hourglass', 'key']
          const symmetryFor = (g: string): CubeFaceState['symmetry'] =>
            ['circle-dot', 'plus-ring', 'square-ring', 'diamond-ring'].includes(g) ? '4-fold' : ['bowtie', 'hourglass'].includes(g) ? '2-fold' : 'asymmetric'
          const order = [...FACE_ORDER]
          const decoratedIdx = new Set<number>()
          while (decoratedIdx.size < params.decoratedFaces) decoratedIdx.add(rng.int(6))
          const overrides: Partial<Record<CubeFace, Partial<CubeFaceState>>> = {}
          order.forEach((face, i) => {
            if (decoratedIdx.has(i)) {
              const g = glyphPool[i % glyphPool.length] as string
              overrides[face] = { glyphId: g, symmetry: symmetryFor(g), rotation: 0, mirrored: false }
            } else {
              overrides[face] = { glyphId: null }
            }
          })
          const answer = makeCube(overrides)

          let distractors: ReturnType<typeof generateDistractors>
          try {
            distractors = generateDistractors(answer, rng, params)
          } catch (e) {
            if (e instanceof DistractorExhaustionError) return // acceptable rare outcome, not a correctness failure
            throw e
          }

          expect(distractors).toHaveLength(4)
          for (const d of distractors) {
            expect(areEquivalent(d.cube, answer)).toBe(false)
          }
          for (let i = 0; i < distractors.length; i++) {
            for (let j = i + 1; j < distractors.length; j++) {
              expect(areEquivalent((distractors[i] as (typeof distractors)[number]).cube, (distractors[j] as (typeof distractors)[number]).cube)).toBe(false)
            }
          }
        },
      ),
      { numRuns: 300 },
    )
  })
})

describe('generateDistractors: difficulty mix', () => {
  const STRUCTURAL: readonly string[] = ['opposite-swap', 'adjacent-permutation']
  const SUBTLE: readonly string[] = ['symbol-rotation', 'symbol-mirror']

  it('easy preset: at least 3 of 4 distractors are structural (opposite-swap/adjacent-permutation)', () => {
    // Mirrors realistic 'easy' generation: decoratedFaces=3 (matching the preset), the rest blank,
    // drawn from the 4-fold-only glyph pool. A handful of seeds may legitimately exhaust the retry
    // budget (rare, expected, and handled at the facade level by redrawing) -- those are skipped,
    // not counted as mix violations.
    const params = expandPreset('easy')
    const glyphPool = ['circle-dot', 'plus-ring', 'square-ring', 'diamond-ring']
    let evaluated = 0
    for (let seed = 0; seed < 400 && evaluated < 150; seed++) {
      const rng = createRng(seed)
      const decoratedIdx = new Set<number>()
      while (decoratedIdx.size < 3) decoratedIdx.add(rng.int(6))
      const faces = Object.fromEntries(
        FACE_ORDER.map((f, i): [CubeFace, CubeFaceState] => [
          f,
          decoratedIdx.has(i)
            ? { glyphId: rng.pick(glyphPool), symmetry: '4-fold', rotation: 0, mirrored: false }
            : { glyphId: null, symmetry: '4-fold', rotation: 0, mirrored: false },
        ]),
      ) as CubeState['faces']
      const answer: CubeState = { faces }

      let distractors: ReturnType<typeof generateDistractors>
      try {
        distractors = generateDistractors(answer, rng, params)
      } catch (e) {
        if (e instanceof DistractorExhaustionError) continue
        throw e
      }
      evaluated++
      const structuralCount = distractors.filter((d) => STRUCTURAL.includes(d.kind)).length
      expect(structuralCount).toBeGreaterThanOrEqual(3)
    }
    expect(evaluated).toBeGreaterThan(50) // sanity: exhaustion isn't swallowing the whole test
  })

  it('hard preset: at least 2 of 4 distractors are subtle (symbol-rotation/symbol-mirror)', () => {
    const params = expandPreset('hard')
    const glyphs = ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning']
    for (let seed = 0; seed < 200; seed++) {
      const answer: CubeState = {
        faces: Object.fromEntries(FACE_ORDER.map((f, i) => [f, { glyphId: glyphs[i], symmetry: 'asymmetric', rotation: 0, mirrored: false }])) as CubeState['faces'],
      }
      const distractors = generateDistractors(answer, createRng(seed), params)
      const subtleCount = distractors.filter((d) => SUBTLE.includes(d.kind)).length
      expect(subtleCount).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('generateDistractors: individual perturbation kinds', () => {
  it('opposite-swap exchanges the content of an opposite face pair', () => {
    const answer = makeCube()
    let found = false
    for (let seed = 0; seed < 50 && !found; seed++) {
      const distractors = generateDistractors(answer, createRng(seed), expandPreset('easy'))
      const swap = distractors.find((d) => d.kind === 'opposite-swap')
      if (!swap) continue
      found = true
      const [a, b] = swap.affectedFaces
      expect(swap.cube.faces[a as CubeFace]).toEqual(answer.faces[b as CubeFace])
      expect(swap.cube.faces[b as CubeFace]).toEqual(answer.faces[a as CubeFace])
    }
    expect(found).toBe(true)
  })

  it('adjacent-permutation cycles 3 mutually-adjacent faces', () => {
    const answer = makeCube()
    let found = false
    for (let seed = 0; seed < 50 && !found; seed++) {
      const distractors = generateDistractors(answer, createRng(seed), expandPreset('easy'))
      const perm = distractors.find((d) => d.kind === 'adjacent-permutation')
      if (!perm) continue
      found = true
      expect(perm.affectedFaces).toHaveLength(3)
      const [a, b, c] = perm.affectedFaces
      expect(perm.cube.faces[a as CubeFace]).toEqual(answer.faces[b as CubeFace])
      expect(perm.cube.faces[b as CubeFace]).toEqual(answer.faces[c as CubeFace])
      expect(perm.cube.faces[c as CubeFace]).toEqual(answer.faces[a as CubeFace])
    }
    expect(found).toBe(true)
  })

  it('symbol-rotation changes only the rotation of one eligible face', () => {
    const answer = makeCube({}, ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning'])
    const distractors = generateDistractors(answer, createRng(3), expandPreset('hard'))
    const rot = distractors.find((d) => d.kind === 'symbol-rotation')
    expect(rot).toBeDefined()
    const face = (rot as (typeof distractors)[number]).affectedFaces[0] as CubeFace
    expect(rot?.cube.faces[face].glyphId).toBe(answer.faces[face].glyphId)
    expect(rot?.cube.faces[face].rotation).not.toBe(answer.faces[face].rotation)
  })

  it('symbol-mirror flips only the mirrored bit of one eligible face', () => {
    const answer = makeCube({}, ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning'])
    let found = false
    for (let seed = 0; seed < 50 && !found; seed++) {
      const distractors = generateDistractors(answer, createRng(seed), expandPreset('hard'))
      const mirror = distractors.find((d) => d.kind === 'symbol-mirror')
      if (!mirror) continue
      found = true
      const face = mirror.affectedFaces[0] as CubeFace
      expect(mirror.cube.faces[face].glyphId).toBe(answer.faces[face].glyphId)
      expect(mirror.cube.faces[face].mirrored).toBe(!answer.faces[face].mirrored)
    }
    expect(found).toBe(true)
  })
})
