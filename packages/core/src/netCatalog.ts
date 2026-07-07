/**
 * The 11 canonical hexomino cube nets, hand-encoded here for zero runtime enumeration cost.
 * This data was derived (not guessed) by brute-force enumeration of all 35 free hexominoes,
 * filtering to those whose spanning-tree fold produces 6 distinct axis-aligned face normals.
 * netCatalog.test.ts re-derives the same enumeration and asserts it matches this table exactly.
 */

export interface CanonicalNet {
  readonly id: number
  /** [col, row] grid coordinates, normalized to start at (0,0). */
  readonly cells: readonly (readonly [number, number])[]
  /** Face-index pairs (indices into `cells`) that share a grid edge. */
  readonly adjacency: readonly (readonly [number, number])[]
}

export const CANONICAL_NETS: readonly CanonicalNet[] = [
  {
    id: 0,
    cells: [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ],
    adjacency: [
      [0, 2],
      [1, 2],
      [2, 3],
      [2, 5],
      [3, 4],
    ],
  },
  {
    id: 1,
    cells: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ],
    adjacency: [
      [0, 3],
      [1, 2],
      [2, 3],
      [2, 5],
      [3, 4],
    ],
  },
  {
    id: 2,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ],
    adjacency: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 5],
      [3, 4],
    ],
  },
  {
    id: 3,
    cells: [
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
    ],
    adjacency: [
      [0, 4],
      [1, 2],
      [2, 3],
      [2, 5],
      [3, 4],
    ],
  },
  {
    id: 4,
    cells: [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [1, 3],
    ],
    adjacency: [
      [0, 3],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5],
    ],
  },
  {
    id: 5,
    cells: [
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    adjacency: [
      [0, 1],
      [0, 4],
      [2, 3],
      [3, 4],
      [3, 5],
    ],
  },
  {
    id: 6,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
    adjacency: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    id: 7,
    cells: [
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [0, 2],
    ],
    adjacency: [
      [0, 4],
      [1, 2],
      [1, 5],
      [2, 3],
      [3, 4],
    ],
  },
  {
    id: 8,
    cells: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
      [3, 2],
    ],
    adjacency: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    id: 9,
    cells: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
    adjacency: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
  },
  {
    id: 10,
    cells: [
      [2, 0],
      [3, 0],
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    adjacency: [
      [0, 1],
      [0, 3],
      [2, 3],
      [2, 5],
      [4, 5],
    ],
  },
]

function cellKey(cell: readonly [number, number]): string {
  return `${cell[0]},${cell[1]}`
}

function normalizeCells(cells: readonly (readonly [number, number])[]): Array<readonly [number, number]> {
  const minCol = Math.min(...cells.map((c) => c[0]))
  const minRow = Math.min(...cells.map((c) => c[1]))
  return cells.map(([c, r]) => [c - minCol, r - minRow] as const)
}

/** All 8 D4 (rotation + reflection) transforms of a cell set, each normalized to start at (0,0). */
function d4Transforms(cells: readonly (readonly [number, number])[]): Array<Array<readonly [number, number]>> {
  const out: Array<Array<readonly [number, number]>> = []
  let cur: Array<readonly [number, number]> = [...cells]
  for (let rot = 0; rot < 4; rot++) {
    out.push(normalizeCells(cur))
    out.push(normalizeCells(cur.map(([c, r]) => [-c, r] as const)))
    cur = cur.map(([c, r]) => [r, -c] as const)
  }
  return out
}

function cellsKey(cells: readonly (readonly [number, number])[]): string {
  return [...cells]
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(cellKey)
    .join(';')
}

/** Canonical key of a hexomino shape under the full D4 symmetry group (rotation + reflection). */
export function normalizeNet(cells: readonly (readonly [number, number])[]): string {
  const keys = d4Transforms(cells).map(cellsKey)
  keys.sort()
  const k = keys[0]
  if (k === undefined) throw new Error('normalizeNet requires at least one cell')
  return k
}
