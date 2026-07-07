import { foldNet } from './foldMapper'
import { CANONICAL_NETS } from './netCatalog'
import type { Rng } from './prng'
import type { CubeFace, DecoratedNet, FaceId, GenerationParams, NetFace, Rotation, Symbol, SymbolSymmetry, SymbolTier } from './types'

/**
 * Glyph pools grouped by symmetry class. Tier selection is pedagogically deliberate:
 * - 'distinct' (easy) draws only 4-fold glyphs: a symbol looks identical at every rotation, so
 *   the task reduces to "spot which face has a different glyph" with no orientation reasoning.
 * - 'orientation-sensitive' (hard) draws only asymmetric/2-fold glyphs, so a symbol-rotation or
 *   symbol-mirror distractor is actually detectable -- a 4-fold glyph would make those distractor
 *   kinds invisible and defeat the point of the hard tier.
 */
export const GLYPH_LIBRARY = {
  asymmetric: ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning'],
  '2-fold': ['bowtie', 'hourglass', 'zigzag-s', 's-curve'],
  // A wide 4-fold pool matters more than it looks: with only opposite-swap/adjacent-permutation
  // viable against 4-fold decorations (rotation/mirror are invisible on them), repeated glyphs
  // shrink the distinguishable-perturbation space fast on a sparsely decorated cube (easy tier
  // decorates only 3 of 6 faces). A wider pool keeps repeats rare.
  '4-fold': ['circle-dot', 'plus-ring', 'square-ring', 'diamond-ring', 'triangle-ring', 'hex-ring', 'star-ring', 'cross-dot'],
} as const satisfies Record<SymbolSymmetry, readonly string[]>

function poolForTier(tier: SymbolTier): readonly Symbol[] {
  const asymmetric = GLYPH_LIBRARY.asymmetric.map((glyphId) => ({ glyphId, symmetry: 'asymmetric' as const, mirrored: false }))
  const twoFold = GLYPH_LIBRARY['2-fold'].map((glyphId) => ({ glyphId, symmetry: '2-fold' as const, mirrored: false }))
  const fourFold = GLYPH_LIBRARY['4-fold'].map((glyphId) => ({ glyphId, symmetry: '4-fold' as const, mirrored: false }))
  switch (tier) {
    case 'distinct':
      return fourFold
    case 'orientation-sensitive':
      return [...asymmetric, ...twoFold]
    case 'mixed':
      return [...asymmetric, ...twoFold, ...fourFold]
  }
}

/** Nets resembling the classic "row of four with one face above and one below" cross shape. */
const FAMILIAR_NET_IDS: readonly number[] = [0, 1, 2, 3, 7]
const FAMILIAR_BIAS_PROBABILITY = 0.7

type Cell = readonly [number, number]

function normalize(cells: readonly Cell[]): Cell[] {
  const minCol = Math.min(...cells.map((c) => c[0]))
  const minRow = Math.min(...cells.map((c) => c[1]))
  return cells.map(([c, r]): Cell => [c - minCol, r - minRow])
}

/** Apply D4 symmetry operation `symOp` (0-7: 4 rotations x optional reflection) to a cell set. */
function applyD4(cells: readonly Cell[], symOp: number): Cell[] {
  const rotations = Math.floor(symOp / 2)
  const reflect = symOp % 2 === 1
  let cur: Cell[] = [...cells]
  for (let i = 0; i < rotations; i++) {
    cur = cur.map(([c, r]): Cell => [r, -c])
  }
  if (reflect) {
    cur = cur.map(([c, r]): Cell => [-c, r])
  }
  return normalize(cur)
}

function chooseNetId(rng: Rng, netBias: GenerationParams['netBias']): number {
  if (netBias === 'familiar' && rng.next() < FAMILIAR_BIAS_PROBABILITY) {
    return rng.pick(FAMILIAR_NET_IDS)
  }
  return rng.int(CANONICAL_NETS.length)
}

function chooseDecoratedIndices(rng: Rng, faceCount: number, decoratedFaces: number): Set<number> {
  const indices = Array.from({ length: faceCount }, (_, i) => i)
  // Fisher-Yates partial shuffle using the seeded stream, fully deterministic.
  for (let i = 0; i < decoratedFaces; i++) {
    const j = i + rng.int(indices.length - i)
    const tmp = indices[i] as number
    indices[i] = indices[j] as number
    indices[j] = tmp
  }
  return new Set(indices.slice(0, decoratedFaces))
}

const ROTATION_CHOICES: readonly Rotation[] = [0, 90, 180, 270]

function decorate(rng: Rng, faceCount: number, params: GenerationParams): Array<NetFace['symbol']> {
  const pool = poolForTier(params.symbolTier)
  const decoratedIndices = chooseDecoratedIndices(rng, faceCount, params.decoratedFaces)
  return Array.from({ length: faceCount }, (_, i) => {
    if (!decoratedIndices.has(i)) return null
    return rng.pick(pool)
  })
}

function isDegenerate(symbols: ReadonlyArray<NetFace['symbol']>): boolean {
  const decorated = symbols.filter((s): s is NonNullable<typeof s> => s !== null)
  if (decorated.length < 2) return false
  const first = decorated[0] as NonNullable<(typeof decorated)[number]>
  return first.symmetry === '4-fold' && decorated.every((s) => s.glyphId === first.glyphId)
}

const OPPOSITE_CUBE_FACE_PAIRS: readonly (readonly [CubeFace, CubeFace])[] = [
  ['+x', '-x'],
  ['+y', '-y'],
  ['+z', '-z'],
]

/**
 * When every glyph is 4-fold (the 'distinct' tier), rotation carries no information at all, so a
 * fully-blank opposite face pair hands the cube a "free" 180-degree rotation symmetry (that pair
 * swaps invisibly under it). Combined with all-4-fold content elsewhere, that hidden symmetry can
 * silently cancel out structural distractor perturbations on unrelated face pairs -- discovered
 * via exhaustion failures in generateProblem's own test suite, not a hypothetical. Since only
 * opposite-swap/adjacent-permutation are ever viable against 4-fold decorations, this check keeps
 * that already-narrow perturbation space from collapsing further.
 */
function hasFullyBlankOppositePair(faceAssignment: Readonly<Record<FaceId, CubeFace>>, glyphByFaceId: ReadonlyMap<FaceId, NetFace['symbol']>): boolean {
  const cubeFaceHasGlyph = new Map<CubeFace, boolean>()
  for (const [faceId, cubeFace] of Object.entries(faceAssignment) as [string, CubeFace][]) {
    cubeFaceHasGlyph.set(cubeFace, glyphByFaceId.get(Number(faceId) as FaceId) !== null)
  }
  return OPPOSITE_CUBE_FACE_PAIRS.some(([a, b]) => !cubeFaceHasGlyph.get(a) && !cubeFaceHasGlyph.get(b))
}

const MAX_REDRAWS = 20

export function generateNet(rng: Rng, params: GenerationParams): DecoratedNet {
  const netRng = rng.fork('netId')
  const symRng = rng.fork('symmetry')
  const decorRng = rng.fork('decoration')

  const netId = chooseNetId(netRng, params.netBias)
  const canonical = CANONICAL_NETS[netId]
  if (!canonical) throw new Error(`internal error: unknown netId ${netId}`)
  const symmetryOp = symRng.int(8)
  const cells = applyD4(canonical.cells, symmetryOp)
  const adjacency = canonical.adjacency.map(([a, b]): [FaceId, FaceId] => [a as FaceId, b as FaceId])

  let symbols: Array<NetFace['symbol']> = []
  let faces: NetFace[] = []
  let succeeded = false
  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    symbols = decorate(decorRng, canonical.cells.length, params)
    if (isDegenerate(symbols)) continue

    faces = cells.map((cell, i) => ({
      id: i as FaceId,
      cell,
      symbol: symbols[i] ?? null,
      symbolRotation: symbols[i] ? decorRng.pick(ROTATION_CHOICES) : 0,
    }))

    if (params.symbolTier === 'distinct') {
      const { plan } = foldNet({ netId, symmetryOp, faces, adjacency })
      const glyphByFaceId = new Map(faces.map((f) => [f.id, f.symbol]))
      if (hasFullyBlankOppositePair(plan.faceAssignment, glyphByFaceId)) continue
    }

    succeeded = true
    break
  }
  if (!succeeded) {
    throw new Error('generateNet: exhausted redraws attempting to avoid a degenerate or under-covered decoration')
  }

  return { netId, symmetryOp, faces, adjacency }
}
