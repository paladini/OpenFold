import { apply, equalMat, IDENTITY, type IMat3, type IVec3, mul, ROTATIONS_24, transpose } from './intMath'
import { CUBE_FACES, type CubeFace, type CubeFaceState, type CubeState, type Rotation } from './types'

const AXIS_VECTORS: Readonly<Record<CubeFace, IVec3>> = {
  '+x': [1, 0, 0],
  '-x': [-1, 0, 0],
  '+y': [0, 1, 0],
  '-y': [0, -1, 0],
  '+z': [0, 0, 1],
  '-z': [0, 0, -1],
}

/** Arbitrary but fixed per-face reference vector defining "rotation = 0". */
const CANONICAL_UP: Readonly<Record<CubeFace, IVec3>> = {
  '+x': [0, 1, 0],
  '-x': [0, 1, 0],
  '+z': [0, 1, 0],
  '-z': [0, 1, 0],
  '+y': [0, 0, 1],
  '-y': [0, 0, 1],
}

function vecEquals(a: IVec3, b: IVec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

export function faceToNormal(face: CubeFace): IVec3 {
  return AXIS_VECTORS[face]
}

export function normalToFace(n: IVec3): CubeFace {
  for (const face of CUBE_FACES) {
    if (vecEquals(AXIS_VECTORS[face], n)) return face
  }
  throw new Error(`vector [${n.join(',')}] is not an axis-aligned unit vector`)
}

export function oppositeFace(face: CubeFace): CubeFace {
  const n = AXIS_VECTORS[face]
  return normalToFace([-n[0], -n[1], -n[2]])
}

const rotate90Cache = new Map<CubeFace, IMat3>()

/** The order-4 rotation matrix representing "rotate 90 degrees about this face's own normal". */
function findRotate90(face: CubeFace): IMat3 {
  const cached = rotate90Cache.get(face)
  if (cached) return cached
  const n = AXIS_VECTORS[face]
  const fixingNonIdentity = ROTATIONS_24.filter((m) => vecEquals(apply(m, n), n) && !equalMat(m, IDENTITY))
  // Exactly 3 non-identity rotations fix a given axis: the 180-degree one (its own inverse)
  // and two order-4 ones (90 and 270) that are mutual inverses. Pick either order-4 element.
  const order4 = fixingNonIdentity.find((m) => !equalMat(mul(m, m), IDENTITY))
  if (!order4) throw new Error(`could not find a 90-degree rotation generator for face ${face}`)
  rotate90Cache.set(face, order4)
  return order4
}

export function rotationToUpVector(face: CubeFace, rotation: Rotation): IVec3 {
  const steps = rotation / 90
  const r90 = findRotate90(face)
  let v = CANONICAL_UP[face]
  for (let i = 0; i < steps; i++) v = apply(r90, v)
  return v
}

export function upVectorToRotation(face: CubeFace, upVec: IVec3): Rotation {
  const r90 = findRotate90(face)
  let v = CANONICAL_UP[face]
  for (const rotation of [0, 90, 180, 270] as const) {
    if (vecEquals(v, upVec)) return rotation
    v = apply(r90, v)
  }
  throw new Error(`vector [${upVec.join(',')}] is not a valid orientation for face ${face}`)
}

/** Rotate an entire physical cube by rotation matrix `m`, remapping faces and their symbol rotations. */
export function rotateCube(cube: CubeState, m: IMat3): CubeState {
  const mInv = transpose(m)
  const faces = {} as Record<CubeFace, CubeFaceState>
  for (const face of CUBE_FACES) {
    const d = AXIS_VECTORS[face]
    const sourceNormal = apply(mInv, d)
    const sourceFace = normalToFace(sourceNormal)
    const source = cube.faces[sourceFace]
    if (source.glyphId === null) {
      faces[face] = { glyphId: null, symmetry: source.symmetry, rotation: 0 }
      continue
    }
    const sourceUp = rotationToUpVector(sourceFace, source.rotation)
    const newUp = apply(m, sourceUp)
    const newRotation = upVectorToRotation(face, newUp)
    faces[face] = { glyphId: source.glyphId, symmetry: source.symmetry, rotation: newRotation }
  }
  return { faces }
}
