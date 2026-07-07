import type { SymbolSymmetry } from '@openfold/core'
import { describe, expect, it } from 'vitest'
import { GLYPH_BY_ID, GLYPH_LIBRARY, getGlyph } from './glyphs'

describe('glyph catalog consistency with @openfold/core', () => {
  it('every glyphId core can generate exists in this table, with a matching symmetry tag', () => {
    for (const symmetry of Object.keys(GLYPH_LIBRARY) as SymbolSymmetry[]) {
      for (const glyphId of GLYPH_LIBRARY[symmetry]) {
        const glyph = GLYPH_BY_ID.get(glyphId)
        expect(glyph, `missing render definition for glyphId "${glyphId}"`).toBeDefined()
        expect(glyph?.symmetry, `symmetry mismatch for glyphId "${glyphId}"`).toBe(symmetry)
      }
    }
  })

  it('every glyph has at least one non-empty subPath', () => {
    for (const glyph of GLYPH_BY_ID.values()) {
      expect(glyph.subPaths.length).toBeGreaterThan(0)
      for (const path of glyph.subPaths) {
        expect(path.length).toBeGreaterThan(0)
      }
    }
  })

  it('getGlyph returns the correct definition and throws for an unknown id', () => {
    expect(getGlyph('arrow').symmetry).toBe('asymmetric')
    expect(() => getGlyph('not-a-real-glyph')).toThrow()
  })
})
