import { CUBE_FACES, type CubeFace, type CubeState } from '@openfold/core'
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { AXIS_VECTORS as FACE_NORMALS, CANONICAL_UP } from './cubeConventions'
import type { SymbolAtlas } from './SymbolAtlas'

function faceBasisMatrix(face: CubeFace): Matrix4 {
  const zAxis = FACE_NORMALS[face].clone()
  const yAxis = CANONICAL_UP[face].clone()
  const xAxis = new Vector3().crossVectors(yAxis, zAxis).normalize()
  return new Matrix4().makeBasis(xAxis, yAxis, zAxis)
}

function buildCubeFaceMesh(face: CubeFace, state: CubeState['faces'][CubeFace], atlas: SymbolAtlas): Mesh {
  const geometry = new BufferGeometry()
  const half = 0.48
  const positions = new Float32Array([-half, -half, 0, half, -half, 0, half, half, 0, -half, half, 0])
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])

  let uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])
  if (state.glyphId) {
    const region = atlas.getUv(state.glyphId, state.rotation)
    const { v0, v1 } = region
    let { u0, u1 } = region
    if (state.mirrored) {
      const tmp = u0
      u0 = u1
      u1 = tmp
    }
    uvs = new Float32Array([u0, v0, u1, v0, u1, v1, u0, v1])
  }
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  geometry.applyMatrix4(faceBasisMatrix(face))
  geometry.translate(...(FACE_NORMALS[face].clone().multiplyScalar(0.5).toArray() as [number, number, number]))

  const material = new MeshBasicMaterial({
    map: atlas.texture,
    color: state.glyphId ? 0xffffff : 0x475569,
    side: DoubleSide,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = `cube-face-${face}`
  return mesh
}

export interface CubeRig {
  readonly group: Group
  dispose(): void
}

/** Renders a static decorated cube (used for both answer alternatives and the folded reference). */
export function buildCube(state: CubeState, atlas: SymbolAtlas): CubeRig {
  const group = new Group()
  const meshes: Mesh[] = []
  for (const face of CUBE_FACES) {
    const mesh = buildCubeFaceMesh(face, state.faces[face], atlas)
    group.add(mesh)
    meshes.push(mesh)
  }
  return {
    group,
    dispose() {
      for (const mesh of meshes) {
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
