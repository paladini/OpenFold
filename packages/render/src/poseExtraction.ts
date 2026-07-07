import { CUBE_FACES, type CubeFace } from '@openfold/core'
import { Vector3 } from 'three'
import { AXIS_VECTORS, CANONICAL_UP } from './cubeConventions'

/** Snaps a (possibly float-imprecise) direction vector to the nearest axis-aligned cube face. */
export function vectorToCubeFace(v: Vector3): CubeFace {
  let best: CubeFace = '+x'
  let bestDot = Number.NEGATIVE_INFINITY
  for (const face of CUBE_FACES) {
    const dot = v.dot(AXIS_VECTORS[face])
    if (dot > bestDot) {
      bestDot = dot
      best = face
    }
  }
  return best
}

/**
 * The "90-degrees-from-reference" tangent direction, matching core cubeGeometry's actual
 * rotate-90 generator per face -- NOT a naive normal x reference formula. core's generator is
 * whichever order-4 rotation happens to be discovered first in its rotation-group BFS, which is
 * not guaranteed to be a single consistent handedness across all 6 faces. Empirically verified
 * (see STATE.md) against ~150 seeded fixtures per axis pair: the correct tangent is the SAME fixed
 * vector for both faces of an axis pair (independent of sign), not derivable from a single
 * cross-product formula without a per-pair sign correction -- so it's tabulated directly instead
 * of computed, to avoid re-introducing a subtle sign bug.
 */
const ROTATION_TANGENT: Readonly<Record<CubeFace, Vector3>> = {
  '+x': new Vector3(0, 0, 1),
  '-x': new Vector3(0, 0, 1),
  '+y': new Vector3(1, 0, 0),
  '-y': new Vector3(1, 0, 0),
  '+z': new Vector3(-1, 0, 0),
  '-z': new Vector3(-1, 0, 0),
}

/**
 * Projects `up` onto the plane perpendicular to `face`'s normal (it should already lie in that
 * plane up to floating-point error) and snaps the angle relative to that face's canonical up
 * reference to the nearest multiple of 90 degrees.
 */
export function upVectorToRotationDegrees(face: CubeFace, up: Vector3): 0 | 90 | 180 | 270 {
  const reference = CANONICAL_UP[face]
  const normal = AXIS_VECTORS[face]
  const projected = up
    .clone()
    .sub(normal.clone().multiplyScalar(up.dot(normal)))
    .normalize()
  const axisB = ROTATION_TANGENT[face]

  const cos = projected.dot(reference)
  const sin = projected.dot(axisB)
  const angleDeg = (Math.atan2(sin, cos) * 180) / Math.PI
  const normalized = ((angleDeg % 360) + 360) % 360
  const snapped = Math.round(normalized / 90) * 90
  const wrapped = snapped % 360
  if (wrapped === 0 || wrapped === 90 || wrapped === 180 || wrapped === 270) return wrapped
  return 0
}
