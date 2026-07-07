import { describe, expect, it } from 'vitest'
import { CANONICAL_NETS, normalizeNet } from './netCatalog'

type Cell = readonly [number, number]

// --- Independent brute-force re-derivation (deliberately not sharing code with netCatalog.ts) ---

function neighbors([col, row]: Cell): Cell[] {
  return [
    [col + 1, row],
    [col - 1, row],
    [col, row + 1],
    [col, row - 1],
  ]
}

function normalize(cells: readonly Cell[]): Cell[] {
  const minCol = Math.min(...cells.map((c) => c[0]))
  const minRow = Math.min(...cells.map((c) => c[1]))
  return cells.map(([c, r]) => [c - minCol, r - minRow])
}

function cellsKey(cells: readonly Cell[]): string {
  return [...cells]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([c, r]) => `${c},${r}`)
    .join(';')
}

function d4Canonical(cells: readonly Cell[]): string {
  const keys: string[] = []
  let cur: Cell[] = [...cells]
  for (let rot = 0; rot < 4; rot++) {
    keys.push(cellsKey(normalize(cur)))
    keys.push(cellsKey(normalize(cur.map(([c, r]): Cell => [-c, r]))))
    cur = cur.map(([c, r]): Cell => [r, -c])
  }
  keys.sort()
  const k = keys[0]
  if (k === undefined) throw new Error('unreachable')
  return k
}

function growFreePolyominoes(n: number): Cell[][] {
  let shapes: Cell[][] = [[[0, 0]]]
  for (let size = 1; size < n; size++) {
    const nextMap = new Map<string, Cell[]>()
    for (const shape of shapes) {
      const cellSet = new Set(shape.map(([c, r]) => `${c},${r}`))
      const candidates = new Set<string>()
      for (const cell of shape) {
        for (const nb of neighbors(cell)) {
          const k = `${nb[0]},${nb[1]}`
          if (!cellSet.has(k)) candidates.add(k)
        }
      }
      for (const cStr of candidates) {
        const parts = cStr.split(',').map(Number)
        const c = parts[0] as number
        const r = parts[1] as number
        const newShape = normalize([...shape, [c, r]])
        const ck = d4Canonical(newShape)
        if (!nextMap.has(ck)) nextMap.set(ck, newShape)
      }
    }
    shapes = Array.from(nextMap.values())
  }
  return shapes
}

// A minimal, independent re-implementation of the fold rule (mirrors intMath's derived sign
// convention) used ONLY to verify catalog foldability from scratch, never imported from
// production code.
type Mat = number[][]
function mul(a: Mat, b: Mat): Mat {
  const r: Mat = []
  for (let i = 0; i < 3; i++) {
    const row: number[] = []
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += (a[i] as number[])[k]! * (b[k] as number[])[j]!
      row.push(s)
    }
    r.push(row)
  }
  return r
}
function apply(m: Mat, v: number[]): number[] {
  return [0, 1, 2].map((i) => (m[i] as number[])[0]! * v[0]! + (m[i] as number[])[1]! * v[1]! + (m[i] as number[])[2]! * v[2]!)
}
const IDENTITY: Mat = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]
const RX_POS: Mat = [
  [1, 0, 0],
  [0, 0, -1],
  [0, 1, 0],
]
const RX_NEG: Mat = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
]
const RY_POS: Mat = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
]
const RY_NEG: Mat = [
  [0, 0, -1],
  [0, 1, 0],
  [1, 0, 0],
]
function localRotation(parent: Cell, child: Cell): Mat {
  const dCol = child[0] - parent[0]
  const dRow = child[1] - parent[1]
  if (dCol === 1) return RY_NEG
  if (dCol === -1) return RY_POS
  if (dRow === 1) return RX_POS
  if (dRow === -1) return RX_NEG
  throw new Error('cells not grid-adjacent')
}

function isFoldableCubeNet(cells: readonly Cell[]): boolean {
  if (cells.length !== 6) return false
  const key = (c: Cell) => `${c[0]},${c[1]}`
  const cellSet = new Set(cells.map(key))
  const adj = new Map<string, Cell[]>(cells.map((c) => [key(c), []]))
  for (const c of cells) {
    for (const nb of neighbors(c)) {
      if (cellSet.has(key(nb))) (adj.get(key(c)) as Cell[]).push(nb)
    }
  }
  const rotById = new Map<string, Mat>([[key(cells[0] as Cell), IDENTITY]])
  const visited = new Set([key(cells[0] as Cell)])
  const queue: Cell[] = [cells[0] as Cell]
  while (queue.length > 0) {
    const cur = queue.shift() as Cell
    const curRot = rotById.get(key(cur)) as Mat
    for (const nb of adj.get(key(cur)) ?? []) {
      if (visited.has(key(nb))) continue
      visited.add(key(nb))
      rotById.set(key(nb), mul(curRot, localRotation(cur, nb)))
      queue.push(nb)
    }
  }
  if (visited.size !== 6) return false
  const normals = new Set(
    cells.map((c) => {
      const rot = rotById.get(key(c)) as Mat
      return apply(rot, [0, 0, 1])
        .map((x) => Math.round(x))
        .join(',')
    }),
  )
  return normals.size === 6
}

// --- Tests ---

describe('CANONICAL_NETS completeness (independent brute-force cross-check)', () => {
  it('the brute-force enumeration finds exactly 35 free hexominoes', () => {
    expect(growFreePolyominoes(6)).toHaveLength(35)
  })

  it('exactly 11 of the 35 free hexominoes fold into a valid closed cube', () => {
    const hexominoes = growFreePolyominoes(6)
    const foldable = hexominoes.filter(isFoldableCubeNet)
    expect(foldable).toHaveLength(11)
  })

  it('CANONICAL_NETS is exactly the set of foldable hexominoes, under D4 normalization', () => {
    const hexominoes = growFreePolyominoes(6)
    const foldableKeys = new Set(hexominoes.filter(isFoldableCubeNet).map(d4Canonical))
    const catalogKeys = new Set(CANONICAL_NETS.map((net) => normalizeNet(net.cells)))

    expect(catalogKeys.size).toBe(11)
    expect(foldableKeys.size).toBe(11)
    expect(catalogKeys).toEqual(foldableKeys)
  })

  it('CANONICAL_NETS has no duplicate entries under D4 normalization', () => {
    const keys = CANONICAL_NETS.map((net) => normalizeNet(net.cells))
    expect(new Set(keys).size).toBe(CANONICAL_NETS.length)
  })
})

describe('CANONICAL_NETS structural integrity', () => {
  it('every net has exactly 6 cells', () => {
    for (const net of CANONICAL_NETS) {
      expect(net.cells).toHaveLength(6)
    }
  })

  it("every net's adjacency graph is connected and matches actual grid adjacency", () => {
    for (const net of CANONICAL_NETS) {
      const key = (c: Cell) => `${c[0]},${c[1]}`
      const cellSet = new Set(net.cells.map(key))
      const expectedEdges = new Set<string>()
      for (let i = 0; i < net.cells.length; i++) {
        for (const nb of neighbors(net.cells[i] as Cell)) {
          if (cellSet.has(key(nb))) {
            const j = net.cells.findIndex((c) => key(c) === key(nb))
            expectedEdges.add([Math.min(i, j), Math.max(i, j)].join('-'))
          }
        }
      }
      const actualEdges = new Set(net.adjacency.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('-')))
      expect(actualEdges).toEqual(expectedEdges)

      // connectivity via BFS over the declared adjacency list
      const adjList = new Map<number, number[]>(net.cells.map((_, i) => [i, []]))
      for (const [a, b] of net.adjacency) {
        ;(adjList.get(a) as number[]).push(b)
        ;(adjList.get(b) as number[]).push(a)
      }
      const visited = new Set([0])
      const queue = [0]
      while (queue.length > 0) {
        const cur = queue.shift() as number
        for (const nb of adjList.get(cur) ?? []) {
          if (!visited.has(nb)) {
            visited.add(nb)
            queue.push(nb)
          }
        }
      }
      expect(visited.size).toBe(6)
    }
  })
})
