export interface Point {
  readonly x: number
  readonly y: number
}

/** A closed polyline in a normalized [-1, 1] coordinate space, centered at the origin. */
export type SubPath = readonly Point[]

export function rotatePoint(p: Point, degrees: number): Point {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

export function rotateSubPath(path: SubPath, degrees: number): SubPath {
  return path.map((p) => rotatePoint(p, degrees))
}

/**
 * Repeat `basePaths` rotated evenly `copies` times around the origin (e.g. copies=4 for a
 * genuinely 90-degree-rotation-invariant glyph). Symmetry holds by construction: rotating the
 * whole result by 360/copies degrees maps each copy exactly onto the next.
 */
export function repeatRotated(basePaths: readonly SubPath[], copies: number): SubPath[] {
  const step = 360 / copies
  const out: SubPath[] = []
  for (let i = 0; i < copies; i++) {
    for (const path of basePaths) out.push(rotateSubPath(path, step * i))
  }
  return out
}

function approxEqual(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps
}

function pointApproxEqual(a: Point, b: Point, eps = 1e-9): boolean {
  return approxEqual(a.x, b.x, eps) && approxEqual(a.y, b.y, eps)
}

/** True if rotating `paths` by 360/n degrees reproduces the same set of subpaths (order-insensitive). */
export function hasRotationalSymmetry(paths: readonly SubPath[], n: number): boolean {
  const rotated = paths.map((p) => rotateSubPath(p, 360 / n))
  const remaining = [...paths]
  for (const rp of rotated) {
    const idx = remaining.findIndex(
      (candidate) => candidate.length === rp.length && candidate.every((pt, i) => pointApproxEqual(pt, rp[i] as Point)),
    )
    if (idx === -1) return false
    remaining.splice(idx, 1)
  }
  return remaining.length === 0
}
