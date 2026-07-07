import { normalToFace, upVectorToRotation } from './cubeGeometry'
import { apply, hingeRotation, IDENTITY, type IMat3, mul } from './intMath'
import type { CubeFaceState, CubeFace, CubeState, DecoratedNet, FaceId, FoldPlan, Hinge, NetFace, Rotation } from './types'

interface LocalHinge {
  readonly rotation: IMat3
  readonly axis: 'x' | 'y'
  readonly sign: 1 | -1
  readonly pivot: readonly [number, number, number]
}

/**
 * The local (parent-frame) fold rotation for a child cell adjacent to a parent cell in the flat
 * net. Every fold is a +90 degree "mountain fold" out of the page; the sign/axis are chosen so
 * that folding always moves the child toward local +Z, regardless of which side it's attached on
 * (verified for all 11 canonical nets by foldMapper.test.ts's bijection property test).
 */
function localHingeFor(parent: NetFace, child: NetFace): LocalHinge {
  const dCol = child.cell[0] - parent.cell[0]
  const dRow = child.cell[1] - parent.cell[1]

  if (dCol === 1) {
    const pivotCol = parent.cell[0] + 1
    const pivot: readonly [number, number, number] = [pivotCol, 0, 0]
    return { rotation: hingeRotation('y', pivot, -1).rotation, axis: 'y', sign: -1, pivot }
  }
  if (dCol === -1) {
    const pivotCol = parent.cell[0]
    const pivot: readonly [number, number, number] = [pivotCol, 0, 0]
    return { rotation: hingeRotation('y', pivot, 1).rotation, axis: 'y', sign: 1, pivot }
  }
  if (dRow === 1) {
    const pivotRow = parent.cell[1] + 1
    const pivot: readonly [number, number, number] = [0, pivotRow, 0]
    return { rotation: hingeRotation('x', pivot, 1).rotation, axis: 'x', sign: 1, pivot }
  }
  if (dRow === -1) {
    const pivotRow = parent.cell[1]
    const pivot: readonly [number, number, number] = [0, pivotRow, 0]
    return { rotation: hingeRotation('x', pivot, -1).rotation, axis: 'x', sign: -1, pivot }
  }
  throw new Error(`faces are not grid-adjacent: ${JSON.stringify(parent.cell)} vs ${JSON.stringify(child.cell)}`)
}

export interface FoldResult {
  readonly cube: CubeState
  readonly plan: FoldPlan
}

export function foldNet(net: DecoratedNet): FoldResult {
  const faceById = new Map<FaceId, NetFace>(net.faces.map((f) => [f.id, f]))
  const adjList = new Map<FaceId, FaceId[]>(net.faces.map((f) => [f.id, []]))
  for (const [a, b] of net.adjacency) {
    ;(adjList.get(a) as FaceId[]).push(b)
    ;(adjList.get(b) as FaceId[]).push(a)
  }

  // Deterministic root: the lexicographically smallest cell (by column, then row).
  const sortedByCell = [...net.faces].sort((a, b) => a.cell[0] - b.cell[0] || a.cell[1] - b.cell[1])
  const root = sortedByCell[0]
  if (!root) throw new Error('foldNet requires a non-empty net')

  const rotationById = new Map<FaceId, IMat3>([[root.id, IDENTITY]])
  const hinges: Hinge[] = []
  const visited = new Set<FaceId>([root.id])
  const queue: FaceId[] = [root.id]

  while (queue.length > 0) {
    const curId = queue.shift() as FaceId
    const curFace = faceById.get(curId)
    const curRotation = rotationById.get(curId)
    if (!curFace || !curRotation) throw new Error('internal error: missing face/rotation during BFS')

    for (const nbId of adjList.get(curId) ?? []) {
      if (visited.has(nbId)) continue
      visited.add(nbId)
      const nbFace = faceById.get(nbId)
      if (!nbFace) throw new Error(`internal error: adjacency references unknown face ${nbId}`)

      const local = localHingeFor(curFace, nbFace)
      rotationById.set(nbId, mul(curRotation, local.rotation))
      hinges.push({ faceId: nbId, parentFaceId: curId, axis: local.axis, pivot: local.pivot, sign: local.sign })
      queue.push(nbId)
    }
  }

  if (visited.size !== net.faces.length) {
    throw new Error('net adjacency graph is not connected — cannot fold into a closed cube')
  }

  const faces = {} as Record<CubeFace, CubeFaceState>
  for (const face of net.faces) {
    const rotation = rotationById.get(face.id)
    if (!rotation) throw new Error(`internal error: no rotation computed for face ${face.id}`)

    const normal = apply(rotation, [0, 0, 1])
    const cubeFace = normalToFace(normal)

    if (face.symbol === null) {
      faces[cubeFace] = { glyphId: null, symmetry: 'asymmetric', rotation: 0, mirrored: false }
      continue
    }

    const upVec = apply(rotation, [0, 1, 0])
    const foldInducedRotation = upVectorToRotation(cubeFace, upVec)
    const finalRotation = ((foldInducedRotation + face.symbolRotation) % 360) as Rotation
    faces[cubeFace] = {
      glyphId: face.symbol.glyphId,
      symmetry: face.symbol.symmetry,
      rotation: finalRotation,
      mirrored: face.symbol.mirrored,
    }
  }

  return { cube: { faces }, plan: { rootFace: root.id, hinges } }
}
