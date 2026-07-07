import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { generateNet } from './netGenerator'
import { CANONICAL_NETS, normalizeNet } from './netCatalog'
import { createRng } from './prng'
import { expandPreset } from './params'
import type { DifficultyPreset, GenerationParams } from './types'

describe('generateNet: net selection frequency', () => {
  it('with netBias=uniform, each of the 11 canonical nets appears within +/-20% of uniform over 11,000 seeds', () => {
    const params: GenerationParams = expandPreset('medium') // netBias: 'uniform'
    const counts = new Map<string, number>()
    for (const net of CANONICAL_NETS) counts.set(normalizeNet(net.cells), 0)

    const totalRuns = 11_000
    for (let seed = 0; seed < totalRuns; seed++) {
      const net = generateNet(createRng(seed), params)
      const key = normalizeNet(net.faces.map((f) => f.cell))
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const expected = totalRuns / CANONICAL_NETS.length
    for (const [key, count] of counts) {
      const deviation = Math.abs(count - expected) / expected
      expect(deviation, `net ${key} deviated by ${(deviation * 100).toFixed(1)}%`).toBeLessThan(0.2)
    }
  })
})

describe('generateNet: structural validity', () => {
  it('[PBT] output always validates against the catalog under D4 normalization', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.constantFrom<DifficultyPreset>('easy', 'medium', 'hard'), (seed, preset) => {
        const net = generateNet(createRng(seed), expandPreset(preset))
        const key = normalizeNet(net.faces.map((f) => f.cell))
        const catalogKeys = new Set(CANONICAL_NETS.map((n) => normalizeNet(n.cells)))
        expect(catalogKeys.has(key)).toBe(true)
        expect(net.faces).toHaveLength(6)
        expect(net.adjacency.length).toBeGreaterThan(0)
      }),
    )
  })

  it('decorates exactly params.decoratedFaces faces, leaving the rest blank', () => {
    for (const preset of ['easy', 'medium', 'hard'] as const) {
      const params = expandPreset(preset)
      for (let seed = 0; seed < 50; seed++) {
        const net = generateNet(createRng(seed), params)
        const decoratedCount = net.faces.filter((f) => f.symbol !== null).length
        expect(decoratedCount).toBe(params.decoratedFaces)
      }
    }
  })

  it('is deterministic: same seed and params produce an identical net', () => {
    const params = expandPreset('hard')
    const a = generateNet(createRng(777), params)
    const b = generateNet(createRng(777), params)
    expect(a).toEqual(b)
  })

  it('rejects a degenerate all-identical-4-fold decoration (redraws until distinguishable)', () => {
    // Sweep many seeds at decoratedFaces=6 with the 'distinct' (4-fold-only) tier -- the tier most
    // likely to collide -- and confirm no output ever has all-6-same-glyph.
    const params: GenerationParams = { decoratedFaces: 6, symbolTier: 'distinct', distractorMix: 'structural', netBias: 'uniform' }
    for (let seed = 0; seed < 500; seed++) {
      const net = generateNet(createRng(seed), params)
      const glyphIds = net.faces.map((f) => f.symbol?.glyphId)
      expect(new Set(glyphIds).size).toBeGreaterThan(1)
    }
  })
})

describe('generateNet: symbol tier semantics', () => {
  it("'distinct' tier only draws 4-fold symmetric glyphs", () => {
    const params = expandPreset('easy')
    for (let seed = 0; seed < 100; seed++) {
      const net = generateNet(createRng(seed), params)
      for (const face of net.faces) {
        if (face.symbol) expect(face.symbol.symmetry).toBe('4-fold')
      }
    }
  })

  it("'orientation-sensitive' tier never draws 4-fold glyphs", () => {
    const params = expandPreset('hard')
    for (let seed = 0; seed < 100; seed++) {
      const net = generateNet(createRng(seed), params)
      for (const face of net.faces) {
        if (face.symbol) expect(face.symbol.symmetry).not.toBe('4-fold')
      }
    }
  })
})
