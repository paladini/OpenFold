import type { DecoratedNet, FaceId, FoldPlan, NetFace } from '@openfold/core'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'
import type { SymbolAtlas } from './SymbolAtlas'

export interface HingeHandle {
  readonly faceId: FaceId
  readonly pivotGroup: Group
  readonly axis: 'x' | 'y'
  readonly sign: 1 | -1
}

export interface NetRig {
  readonly root: Group
  readonly hinges: readonly HingeHandle[]
  readonly faceMeshes: ReadonlyMap<FaceId, Mesh>
  dispose(): void
}

function faceOrigin(face: NetFace): [number, number, number] {
  return [face.cell[0] + 0.5, face.cell[1] + 0.5, 0]
}

function buildFaceMesh(face: NetFace, atlas: SymbolAtlas): Mesh {
  const geometry = new BufferGeometry()
  const half = 0.48 // slight inset so adjacent faces don't z-fight at the seam
  const positions = new Float32Array([-half, -half, 0, half, -half, 0, half, half, 0, -half, half, 0])
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])

  let uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  if (face.symbol) {
    const region = atlas.getUv(face.symbol.glyphId, face.symbolRotation)
    const { v0, v1 } = region
    let { u0, u1 } = region
    if (face.symbol.mirrored) {
      const tmp = u0
      u0 = u1
      u1 = tmp
    }
    uvs = new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1])
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()

  const material = new MeshBasicMaterial({
    map: atlas.texture,
    color: face.symbol ? 0xffffff : 0x475569,
    side: DoubleSide,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = `net-face-${face.id}`
  mesh.userData.faceId = face.id
  return mesh
}

/**
 * Builds the hinge-group hierarchy from a FoldPlan using the standard "pivot group" technique:
 * each hinge gets an intermediate Group positioned exactly at the hinge line (relative to its
 * parent face's own local origin); rotating that group about its own axis rotates its subtree
 * about the hinge -- and because Three.js composes child.worldMatrix = parent.worldMatrix *
 * child.localMatrix, the accumulated world rotation of any face exactly matches foldMapper's own
 * mul(accumulatedRotation, localHingeRotation) recursion. The face's own content group is then
 * offset back so that at hinge angle 0 (fully unfolded) every face sits at its flat net position.
 */
export function buildNet(net: DecoratedNet, plan: FoldPlan, atlas: SymbolAtlas): NetRig {
  const faceById = new Map(net.faces.map((f) => [f.id, f]))
  const faceGroupById = new Map<FaceId, Group>()
  const faceMeshes = new Map<FaceId, Mesh>()
  const hinges: HingeHandle[] = []

  const rootFace = faceById.get(plan.rootFace)
  if (!rootFace) throw new Error(`buildNet: root face ${plan.rootFace} not found in net`)

  const root = new Group()
  root.name = `face-group-${rootFace.id}`
  const [ox, oy, oz] = faceOrigin(rootFace)
  root.position.set(ox, oy, oz)
  const rootMesh = buildFaceMesh(rootFace, atlas)
  root.add(rootMesh)
  faceMeshes.set(rootFace.id, rootMesh)
  faceGroupById.set(rootFace.id, root)

  for (const hinge of plan.hinges) {
    const parentFace = faceById.get(hinge.parentFaceId)
    const childFace = faceById.get(hinge.faceId)
    const parentGroup = faceGroupById.get(hinge.parentFaceId)
    if (!parentFace || !childFace || !parentGroup) {
      throw new Error(`buildNet: malformed FoldPlan hinge referencing unknown face`)
    }

    const parentOrigin = faceOrigin(parentFace)
    const childOrigin = faceOrigin(childFace)

    const pivotGroup = new Group()
    pivotGroup.name = `pivot-${hinge.parentFaceId}-${hinge.faceId}`
    pivotGroup.position.set(hinge.pivot[0] - parentOrigin[0], hinge.pivot[1] - parentOrigin[1], hinge.pivot[2] - parentOrigin[2])
    parentGroup.add(pivotGroup)

    const childGroup = new Group()
    childGroup.name = `face-group-${childFace.id}`
    childGroup.position.set(childOrigin[0] - hinge.pivot[0], childOrigin[1] - hinge.pivot[1], childOrigin[2] - hinge.pivot[2])
    pivotGroup.add(childGroup)

    const mesh = buildFaceMesh(childFace, atlas)
    childGroup.add(mesh)
    faceMeshes.set(childFace.id, mesh)
    faceGroupById.set(childFace.id, childGroup)

    hinges.push({ faceId: hinge.faceId, pivotGroup, axis: hinge.axis, sign: hinge.sign })
  }

  return {
    root,
    hinges,
    faceMeshes,
    dispose() {
      for (const mesh of faceMeshes.values()) {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          for (const m of mesh.material) m.dispose()
        } else {
          mesh.material.dispose()
        }
      }
    },
  }
}
