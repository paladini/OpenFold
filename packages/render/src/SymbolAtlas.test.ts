import { beforeAll, describe, expect, it } from 'vitest'
import { GLYPH_BY_ID } from './glyphs'
import { SymbolAtlas } from './SymbolAtlas'
import { installFakeCanvasContext } from './testSupport/fakeCanvasContext'

beforeAll(() => {
  installFakeCanvasContext()
})

describe('SymbolAtlas', () => {
  it('constructs a texture once and exposes it', () => {
    const atlas = new SymbolAtlas()
    expect(atlas.texture).toBeDefined()
    atlas.dispose()
  })

  it('getUv returns a distinct region for every (glyphId, rotation) pair', () => {
    const atlas = new SymbolAtlas()
    const seen = new Set<string>()
    for (const glyphId of GLYPH_BY_ID.keys()) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const region = atlas.getUv(glyphId, rotation)
        const key = `${region.u0},${region.v0},${region.u1},${region.v1}`
        expect(seen.has(key), `duplicate UV region for ${glyphId}:${rotation}`).toBe(false)
        seen.add(key)
      }
    }
    atlas.dispose()
  })

  it('every UV region is a valid, non-degenerate rectangle within [0,1]', () => {
    const atlas = new SymbolAtlas()
    for (const glyphId of GLYPH_BY_ID.keys()) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const r = atlas.getUv(glyphId, rotation)
        expect(r.u0).toBeGreaterThanOrEqual(0)
        expect(r.v0).toBeGreaterThanOrEqual(0)
        expect(r.u1).toBeLessThanOrEqual(1)
        expect(r.v1).toBeLessThanOrEqual(1)
        expect(r.u1).toBeGreaterThan(r.u0)
        expect(r.v1).toBeGreaterThan(r.v0)
      }
    }
    atlas.dispose()
  })

  it('the same (glyphId, rotation) always returns the identical region (idempotent lookup)', () => {
    const atlas = new SymbolAtlas()
    const a = atlas.getUv('arrow', 90)
    const b = atlas.getUv('arrow', 90)
    expect(a).toEqual(b)
    atlas.dispose()
  })

  it('throws for an unknown glyphId', () => {
    const atlas = new SymbolAtlas()
    expect(() => atlas.getUv('not-a-glyph', 0)).toThrow()
    atlas.dispose()
  })

  it('dispose() disposes the underlying texture', () => {
    const atlas = new SymbolAtlas()
    let disposed = false
    atlas.texture.addEventListener('dispose', () => {
      disposed = true
    })
    atlas.dispose()
    expect(disposed).toBe(true)
  })
})
