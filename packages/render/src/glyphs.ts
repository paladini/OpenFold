import { GLYPH_LIBRARY, type SymbolSymmetry } from '@openfold/core'
import { repeatRotated, type SubPath } from './glyphPath'

export interface GlyphDef {
  readonly glyphId: string
  readonly symmetry: SymbolSymmetry
  readonly subPaths: readonly SubPath[]
}

// --- Reusable motifs, each built via repeatRotated so N-fold symmetry holds by construction. ---

const DIAMOND_ARM: SubPath = [
  { x: 0, y: 0.15 },
  { x: 0.12, y: 0.45 },
  { x: 0, y: 0.85 },
  { x: -0.12, y: 0.45 },
]

const TOOTH: SubPath = [
  { x: -0.08, y: 0.55 },
  { x: 0, y: 0.85 },
  { x: 0.08, y: 0.55 },
]

const SPIKE: SubPath = [
  { x: -0.05, y: 0.3 },
  { x: 0, y: 0.85 },
  { x: 0.05, y: 0.3 },
]

const PETAL: SubPath = [
  { x: 0, y: 0.1 },
  { x: 0.28, y: 0.35 },
  { x: 0, y: 0.6 },
  { x: -0.28, y: 0.35 },
]

const DOT_RING_UNIT: SubPath = [
  { x: -0.05, y: 0.6 },
  { x: 0.05, y: 0.6 },
  { x: 0.05, y: 0.7 },
  { x: -0.05, y: 0.7 },
]

const CENTER_DOT: SubPath = [
  { x: -0.08, y: -0.08 },
  { x: 0.08, y: -0.08 },
  { x: 0.08, y: 0.08 },
  { x: -0.08, y: 0.08 },
]

const S_CURVE_HALF: SubPath = [
  { x: 0, y: 0 },
  { x: 0.3, y: 0.1 },
  { x: 0.35, y: 0.4 },
  { x: 0.15, y: 0.55 },
]

const BOWTIE_HALF: SubPath = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0.35 },
  { x: 0.5, y: -0.35 },
]

const HOURGLASS_HALF: SubPath = [
  { x: -0.35, y: 0.5 },
  { x: 0.35, y: 0.5 },
  { x: 0, y: 0 },
]

const GLYPHS: readonly GlyphDef[] = [
  // -- asymmetric (6): each hand-authored, no enforced rotational symmetry --
  {
    glyphId: 'arrow',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: 0, y: 0.8 },
        { x: 0.35, y: 0.2 },
        { x: 0.12, y: 0.2 },
        { x: 0.12, y: -0.7 },
        { x: -0.12, y: -0.7 },
        { x: -0.12, y: 0.2 },
        { x: -0.35, y: 0.2 },
      ],
    ],
  },
  {
    glyphId: 'flag',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: -0.1, y: -0.8 },
        { x: 0.05, y: -0.8 },
        { x: 0.05, y: 0.8 },
        { x: -0.1, y: 0.8 },
      ],
      [
        { x: 0.05, y: 0.75 },
        { x: 0.65, y: 0.45 },
        { x: 0.05, y: 0.15 },
      ],
    ],
  },
  {
    glyphId: 'l-shape',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: -0.4, y: 0.7 },
        { x: -0.15, y: 0.7 },
        { x: -0.15, y: -0.45 },
        { x: 0.4, y: -0.45 },
        { x: 0.4, y: -0.7 },
        { x: -0.4, y: -0.7 },
      ],
    ],
  },
  {
    glyphId: 'boot',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: -0.3, y: 0.75 },
        { x: 0.05, y: 0.75 },
        { x: 0.05, y: -0.15 },
        { x: 0.55, y: -0.4 },
        { x: 0.55, y: -0.75 },
        { x: -0.3, y: -0.75 },
      ],
    ],
  },
  {
    glyphId: 'key',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: -0.55, y: 0.35 },
        { x: -0.15, y: 0.35 },
        { x: -0.15, y: -0.35 },
        { x: -0.55, y: -0.35 },
      ],
      [
        { x: -0.15, y: 0.1 },
        { x: 0.6, y: 0.1 },
        { x: 0.6, y: -0.1 },
        { x: 0.35, y: -0.1 },
        { x: 0.35, y: -0.35 },
        { x: 0.15, y: -0.35 },
        { x: 0.15, y: -0.1 },
        { x: -0.15, y: -0.1 },
      ],
    ],
  },
  {
    glyphId: 'lightning',
    symmetry: 'asymmetric',
    subPaths: [
      [
        { x: 0.15, y: 0.8 },
        { x: -0.3, y: 0.05 },
        { x: 0, y: 0.05 },
        { x: -0.15, y: -0.8 },
        { x: 0.3, y: 0 },
        { x: 0, y: 0 },
      ],
    ],
  },

  // -- 2-fold (4): each built via repeatRotated(motif, 2) --
  { glyphId: 'bowtie', symmetry: '2-fold', subPaths: repeatRotated([BOWTIE_HALF], 2) },
  { glyphId: 'hourglass', symmetry: '2-fold', subPaths: repeatRotated([HOURGLASS_HALF], 2) },
  { glyphId: 'zigzag-s', symmetry: '2-fold', subPaths: repeatRotated([S_CURVE_HALF], 2) },
  { glyphId: 's-curve', symmetry: '2-fold', subPaths: repeatRotated([S_CURVE_HALF, DIAMOND_ARM], 2) },

  // -- 4-fold (8): each built via repeatRotated(motif, 4 or 8) -- symmetry order is always a
  // multiple of 4, so all are genuinely invariant under 90-degree rotation.
  { glyphId: 'circle-dot', symmetry: '4-fold', subPaths: [...repeatRotated([DOT_RING_UNIT], 16), CENTER_DOT] },
  { glyphId: 'plus-ring', symmetry: '4-fold', subPaths: repeatRotated([DIAMOND_ARM], 4) },
  {
    glyphId: 'square-ring',
    symmetry: '4-fold',
    subPaths: [
      [
        { x: -0.6, y: -0.6 },
        { x: 0.6, y: -0.6 },
        { x: 0.6, y: 0.6 },
        { x: -0.6, y: 0.6 },
      ],
    ],
  },
  { glyphId: 'diamond-ring', symmetry: '4-fold', subPaths: repeatRotated([TOOTH], 4) },
  { glyphId: 'quatrefoil-ring', symmetry: '4-fold', subPaths: repeatRotated([PETAL], 4) },
  { glyphId: 'octagon-ring', symmetry: '4-fold', subPaths: repeatRotated([TOOTH, DOT_RING_UNIT], 8) },
  { glyphId: 'eight-point-star', symmetry: '4-fold', subPaths: repeatRotated([SPIKE], 8) },
  { glyphId: 'cross-dot', symmetry: '4-fold', subPaths: [...repeatRotated([DIAMOND_ARM], 4), CENTER_DOT] },
]

export const GLYPH_BY_ID: ReadonlyMap<string, GlyphDef> = new Map(GLYPHS.map((g) => [g.glyphId, g]))

export function getGlyph(glyphId: string): GlyphDef {
  const glyph = GLYPH_BY_ID.get(glyphId)
  if (!glyph) throw new Error(`unknown glyphId: ${glyphId}`)
  return glyph
}

export { GLYPHS, GLYPH_LIBRARY }
