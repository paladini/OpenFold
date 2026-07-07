import type { CubeFace } from '@openfold/core'
import { Vector3 } from 'three'

export const AXIS_VECTORS: Readonly<Record<CubeFace, Vector3>> = {
  '+x': new Vector3(1, 0, 0),
  '-x': new Vector3(-1, 0, 0),
  '+y': new Vector3(0, 1, 0),
  '-y': new Vector3(0, -1, 0),
  '+z': new Vector3(0, 0, 1),
  '-z': new Vector3(0, 0, -1),
}

/**
 * Per-face "rotation = 0" reference, matching core's cubeGeometry.ts convention: faces on the x/z
 * axes use world +Y as their reference; faces on the y axis use world +Z (since +Y can't serve as
 * its own perpendicular reference there). Both CubeBuilder (writes geometry from a rotation label)
 * and poseExtraction (reads a rotation label back from rendered geometry) must agree on this table
 * for the render <-> core pose-equivalence check to mean anything.
 */
export const CANONICAL_UP: Readonly<Record<CubeFace, Vector3>> = {
  '+x': new Vector3(0, 1, 0),
  '-x': new Vector3(0, 1, 0),
  '+z': new Vector3(0, 1, 0),
  '-z': new Vector3(0, 1, 0),
  '+y': new Vector3(0, 0, 1),
  '-y': new Vector3(0, 0, 1),
}
