import { CANONICAL_NETS } from './netCatalog'
import type { Rng } from './prng'
import type { DecoratedNet, FaceId, GenerationParams, NetFace, Rotation, SymbolSymmetry, SymbolTier } from './types'

/**
 * Glyph pools grouped by symmetry class. Tier selection is pedagogically deliberate:
 * - 'distinct' (easy) draws only 4-fold glyphs: a symbol looks identical at every rotation, so
 *   the task reduces to "spot which face has a different glyph" with no orientation reasoning.
 * - 'orientation-sensitive' (hard) draws only asymmetric/2-fold glyphs, so a symbol-rotation or
 *   symbol-mirror distractor is actually detectable -- a 4-fold glyph would make those distractor
 *   kinds invisible and defeat the point of the hard tier.
 */
const GLYPH_LIBRARY: Readonly<Record<SymbolSymmetry, readonly string[]>> = {
  asymmetric: ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning'],
  '2-fold': ['bowtie', 'hourglass', 'zigzag-s', 's-curve'],
  '4-fold': ['circle-dot', 'plus-ring', 'square-ring', 'diamond-ring'],
}

interface GlyphOption {
  readonly glyphId: string
  readonly symmetry: SymbolSymmetry
}

function poolForTier(tier: SymbolTier): readonly GlyphOption[] {
  const asymmetric = GLYPH_LIBRARY.asymmetric.map((glyphId) => ({ glyphId, symmetry: 'asymmetric' as const }))
  const twoFold = GLYPH_LIBRARY['2-fold'].map((glyphId) => ({ glyphId, symmetry: '2-fold' as const }))
  const fourFold = GLYPH_LIBRARY['4-fold'].map((glyphId) => ({ glyphId, symmetry: '4-fold' as const }))
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

  let symbols: Array<NetFace['symbol']> = []
  for (let attempt = 0; attempt < MAX_REDRAWS; attempt++) {
    symbols = decorate(decorRng, canonical.cells.length, params)
    if (!isDegenerate(symbols)) break
  }
  if (isDegenerate(symbols)) {
    throw new Error('generateNet: exhausted redraws attempting to avoid a degenerate all-identical decoration')
  }

  const faces: NetFace[] = cells.map((cell, i) => ({
    id: i as FaceId,
    cell,
    symbol: symbols[i] ?? null,
    symbolRotation: symbols[i] ? decorRng.pick(ROTATION_CHOICES) : 0,
  }))

  return {
    netId,
    symmetryOp,
    faces,
    adjacency: canonical.adjacency.map(([a, b]) => [a as FaceId, b as FaceId]),
  }
}
