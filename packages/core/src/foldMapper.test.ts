import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { foldNet } from './foldMapper'
import { CANONICAL_NETS, type CanonicalNet } from './netCatalog'
import { CUBE_FACES, type CubeFace, type DecoratedNet, type FaceId, type NetFace, type Rotation } from './types'

const GLYPH_IDS = ['A', 'B', 'C', 'D', 'E', 'F']

function toFaceAdjacency(adjacency: CanonicalNet['adjacency']): DecoratedNet['adjacency'] {
  return adjacency.map(([a, b]) => [a as FaceId, b as FaceId])
}

function buildNet(canonical: CanonicalNet, glyphs: readonly (string | null)[] = GLYPH_IDS): DecoratedNet {
  const faces: NetFace[] = canonical.cells.map((cell, i) => ({
    id: i as NetFace['id'],
    cell,
    symbol: glyphs[i] ? { glyphId: glyphs[i] as string, symmetry: 'asymmetric', mirrored: false } : null,
    symbolRotation: 0,
  }))
  return { netId: canonical.id, symmetryOp: 0, faces, adjacency: toFaceAdjacency(canonical.adjacency) }
}

/** All 8 D4 transforms of a net's cells, each renormalized to start at (0,0). */
function applySymmetry(cells: readonly (readonly [number, number])[], symOp: number): Array<readonly [number, number]> {
  let cur: Array<readonly [number, number]> = cells.map((c) => c)
  const rotations = Math.floor(symOp / 2)
  const reflect = symOp % 2 === 1
  for (let i = 0; i < rotations; i++) {
    cur = cur.map(([c, r]) => [r, -c] as const)
  }
  if (reflect) {
    cur = cur.map(([c, r]) => [-c, r] as const)
  }
  const minCol = Math.min(...cur.map((c) => c[0]))
  const minRow = Math.min(...cur.map((c) => c[1]))
  return cur.map(([c, r]) => [c - minCol, r - minRow] as const)
}

describe('foldNet: worked example (net #6, a "T" shaped hexomino)', () => {
  // Shape (col across, row down):
  //   row0: face0(0,0) face1(1,0) face2(2,0)
  //   row1:             face3(1,1)
  //   row2:             face4(1,2)
  //   row3:             face5(1,3)
  // Root is the lexicographically smallest cell -> face0 at (0,0), which always maps to +Z.
  const net = buildNet(CANONICAL_NETS[6] as CanonicalNet)

  it('folds into a valid cube: bijection onto the 6 axis-aligned faces', () => {
    const { cube } = foldNet(net)
    const glyphsPresent = CUBE_FACES.map((f) => cube.faces[f].glyphId)
    expect(new Set(glyphsPresent)).toEqual(new Set(GLYPH_IDS))
    // Root face (face0, glyph A) always lands on +Z with rotation 0 by construction.
    expect(cube.faces['+z']).toEqual({ glyphId: 'A', symmetry: 'asymmetric', rotation: 0, mirrored: false })
  })

  it('matches the verified reference output for this fixture (regression guard)', () => {
    const { cube, plan } = foldNet(net)
    expect(cube.faces).toEqual({
      '+z': { glyphId: 'A', symmetry: 'asymmetric', rotation: 0, mirrored: false },
      '-x': { glyphId: 'B', symmetry: 'asymmetric', rotation: 0, mirrored: false },
      '-z': { glyphId: 'C', symmetry: 'asymmetric', rotation: 0, mirrored: false },
      '-y': { glyphId: 'D', symmetry: 'asymmetric', rotation: 270, mirrored: false },
      '+x': { glyphId: 'E', symmetry: 'asymmetric', rotation: 180, mirrored: false },
      '+y': { glyphId: 'F', symmetry: 'asymmetric', rotation: 90, mirrored: false },
    })
    expect(plan.rootFace).toBe(0)
    expect(plan.hinges).toHaveLength(5)
  })

  it('FoldPlan hinges form a spanning tree covering every non-root face exactly once', () => {
    const { plan } = foldNet(net)
    const coveredFaces = new Set(plan.hinges.map((h) => h.faceId))
    expect(coveredFaces.size).toBe(5) // all faces except the root
    expect(coveredFaces.has(plan.rootFace)).toBe(false)
  })
})

describe('foldNet: bijection property across all nets, symmetries, and decorations', () => {
  it('[PBT] every canonical net, under every D4 symmetry, folds to exactly the 6 axis faces with no overlap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CANONICAL_NETS.length - 1 }),
        fc.integer({ min: 0, max: 7 }),
        fc.array(fc.constantFrom<Rotation>(0, 90, 180, 270), { minLength: 6, maxLength: 6 }),
        (netIdx, symOp, rotations) => {
          const canonical = CANONICAL_NETS[netIdx] as CanonicalNet
          const transformedCells = applySymmetry(canonical.cells, symOp)
          const faces: NetFace[] = transformedCells.map((cell, i) => ({
            id: i as NetFace['id'],
            cell,
            symbol: { glyphId: `g${i}`, symmetry: 'asymmetric', mirrored: false },
            symbolRotation: rotations[i] as Rotation,
          }))
          const net: DecoratedNet = { netId: canonical.id, symmetryOp: symOp, faces, adjacency: toFaceAdjacency(canonical.adjacency) }

          const { cube, plan } = foldNet(net)

          const faceValues = CUBE_FACES.map((f) => cube.faces[f])
          expect(faceValues.every((v) => v.glyphId !== null)).toBe(true)
          const glyphSet = new Set(faceValues.map((v) => v.glyphId))
          expect(glyphSet.size).toBe(6) // bijection: 6 distinct net faces -> 6 distinct cube faces

          expect(plan.hinges).toHaveLength(5)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('root face always maps to +Z with rotation equal to its own symbolRotation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CANONICAL_NETS.length - 1 }),
        fc.constantFrom<Rotation>(0, 90, 180, 270),
        (netIdx, rootRotation) => {
          const canonical = CANONICAL_NETS[netIdx] as CanonicalNet
          const sorted = [...canonical.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])
          const rootCell = sorted[0] as readonly [number, number]
          const rootLocalIndex = canonical.cells.findIndex((c) => c[0] === rootCell[0] && c[1] === rootCell[1])

          const faces: NetFace[] = canonical.cells.map((cell, i) => ({
            id: i as NetFace['id'],
            cell,
            symbol: { glyphId: `g${i}`, symmetry: 'asymmetric', mirrored: false },
            symbolRotation: i === rootLocalIndex ? rootRotation : 0,
          }))
          const net: DecoratedNet = { netId: canonical.id, symmetryOp: 0, faces, adjacency: toFaceAdjacency(canonical.adjacency) }

          const { cube, plan } = foldNet(net)
          expect(plan.rootFace).toBe(rootLocalIndex)
          expect(cube.faces['+z' as CubeFace].rotation).toBe(rootRotation)
        },
      ),
    )
  })
})

describe('foldNet: blank faces', () => {
  it('a face with no symbol renders as a blank cube face (glyphId null, rotation 0)', () => {
    const glyphs: (string | null)[] = ['A', null, 'C', 'D', 'E', 'F']
    const net = buildNet(CANONICAL_NETS[6] as CanonicalNet, glyphs)
    const { cube } = foldNet(net)
    const blankFace = CUBE_FACES.find((f) => cube.faces[f].glyphId === null)
    expect(blankFace).toBeDefined()
    expect(cube.faces[blankFace as CubeFace]).toEqual({ glyphId: null, symmetry: 'asymmetric', rotation: 0, mirrored: false })
  })
})

describe('foldNet: disconnected net rejection', () => {
  it('throws if the adjacency graph does not cover all 6 faces', () => {
    const faces: NetFace[] = [0, 1, 2, 3, 4, 5].map((i) => ({
      id: i as NetFace['id'],
      cell: [i, 0],
      symbol: null,
      symbolRotation: 0,
    }))
    // Deliberately broken adjacency: face 5 is isolated.
    const net: DecoratedNet = {
      netId: 99,
      symmetryOp: 0,
      faces,
      adjacency: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    }
    expect(() => foldNet(net)).toThrow(/not connected/)
  })
})
