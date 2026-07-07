import { CUBE_FACES, type CubeFace, type CubeState } from '@openfold/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { Mesh, Vector3 } from 'three'
import { buildCube } from './CubeBuilder'
import { SymbolAtlas } from './SymbolAtlas'
import { installFakeCanvasContext } from './testSupport/fakeCanvasContext'

beforeAll(() => {
  installFakeCanvasContext()
})

const GLYPHS = ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning']

function makeCubeState(glyphs: Partial<Record<CubeFace, string | null>> = {}): CubeState {
  const faces: Record<CubeFace, CubeState['faces'][CubeFace]> = {} as Record<CubeFace, CubeState['faces'][CubeFace]>
  CUBE_FACES.forEach((face, i) => {
    const glyphId = face in glyphs ? (glyphs[face] as string | null) : (GLYPHS[i] as string)
    faces[face] = { glyphId, symmetry: 'asymmetric', rotation: 0, mirrored: false }
  })
  return { faces }
}

function withMirrored(state: CubeState, face: CubeFace): CubeState {
  return { faces: { ...state.faces, [face]: { ...state.faces[face], mirrored: true } } }
}

describe('buildCube: structure', () => {
  it('produces exactly 6 face meshes, one named per cube face', () => {
    const atlas = new SymbolAtlas()
    const rig = buildCube(makeCubeState(), atlas)
    expect(rig.group.children).toHaveLength(6)
    const names = new Set(rig.group.children.map((c) => c.name))
    for (const face of CUBE_FACES) {
      expect(names.has(`cube-face-${face}`)).toBe(true)
    }
    rig.dispose()
    atlas.dispose()
  })
})

describe('buildCube: face placement', () => {
  it('each face mesh is centered at 0.5 * its outward normal', () => {
    const atlas = new SymbolAtlas()
    const rig = buildCube(makeCubeState(), atlas)
    const expectedCenters: Record<CubeFace, Vector3> = {
      '+x': new Vector3(0.5, 0, 0),
      '-x': new Vector3(-0.5, 0, 0),
      '+y': new Vector3(0, 0.5, 0),
      '-y': new Vector3(0, -0.5, 0),
      '+z': new Vector3(0, 0, 0.5),
      '-z': new Vector3(0, 0, -0.5),
    }
    for (const mesh of rig.group.children as Mesh[]) {
      const face = mesh.name.replace('cube-face-', '') as CubeFace
      const positionAttr = mesh.geometry.getAttribute('position')
      // Average of the 4 quad vertices = the face's center in local (== world, group untransformed) space.
      let cx = 0
      let cy = 0
      let cz = 0
      for (let i = 0; i < 4; i++) {
        cx += positionAttr.getX(i)
        cy += positionAttr.getY(i)
        cz += positionAttr.getZ(i)
      }
      const center = new Vector3(cx / 4, cy / 4, cz / 4)
      const expected = expectedCenters[face]
      expect(center.x).toBeCloseTo(expected.x)
      expect(center.y).toBeCloseTo(expected.y)
      expect(center.z).toBeCloseTo(expected.z)
    }
    rig.dispose()
    atlas.dispose()
  })

  it('each face mesh faces outward (computed normal matches the cube face direction)', () => {
    const atlas = new SymbolAtlas()
    const rig = buildCube(makeCubeState(), atlas)
    const expectedNormals: Record<CubeFace, Vector3> = {
      '+x': new Vector3(1, 0, 0),
      '-x': new Vector3(-1, 0, 0),
      '+y': new Vector3(0, 1, 0),
      '-y': new Vector3(0, -1, 0),
      '+z': new Vector3(0, 0, 1),
      '-z': new Vector3(0, 0, -1),
    }
    for (const mesh of rig.group.children as Mesh[]) {
      const face = mesh.name.replace('cube-face-', '') as CubeFace
      const normalAttr = mesh.geometry.getAttribute('normal')
      const n = new Vector3(normalAttr.getX(0), normalAttr.getY(0), normalAttr.getZ(0))
      const expected = expectedNormals[face]
      expect(n.dot(expected)).toBeCloseTo(1, 4)
    }
    rig.dispose()
    atlas.dispose()
  })
})

describe('buildCube: UVs and materials', () => {
  it('assigns UVs matching the atlas region for each decorated face', () => {
    const atlas = new SymbolAtlas()
    const state = makeCubeState()
    const rig = buildCube(state, atlas)
    for (const mesh of rig.group.children as Mesh[]) {
      const face = mesh.name.replace('cube-face-', '') as CubeFace
      const faceState = state.faces[face]
      const uvAttr = mesh.geometry.getAttribute('uv')
      if (!faceState.glyphId) continue
      const region = atlas.getUv(faceState.glyphId, faceState.rotation)
      expect(uvAttr.getX(0)).toBeCloseTo(region.u0)
      expect(uvAttr.getY(0)).toBeCloseTo(region.v0)
    }
    rig.dispose()
    atlas.dispose()
  })

  it('blank faces get the neutral material color and a default quad UV', () => {
    const atlas = new SymbolAtlas()
    const state = makeCubeState({ '+z': null })
    const rig = buildCube(state, atlas)
    const blankMesh = rig.group.children.find((c) => c.name === 'cube-face-+z') as Mesh
    const material = blankMesh.material as import('three').MeshBasicMaterial
    expect(material.color.getHex()).toBe(0x475569)
    rig.dispose()
    atlas.dispose()
  })

  it('mirrored faces swap the U coordinates of the quad', () => {
    const atlas = new SymbolAtlas()
    const state = withMirrored(makeCubeState(), '+x')
    const rig = buildCube(state, atlas)
    const mesh = rig.group.children.find((c) => c.name === 'cube-face-+x') as Mesh
    const region = atlas.getUv(state.faces['+x'].glyphId as string, state.faces['+x'].rotation)
    const uvAttr = mesh.geometry.getAttribute('uv')
    expect(uvAttr.getX(0)).toBeCloseTo(region.u1)
    expect(uvAttr.getX(1)).toBeCloseTo(region.u0)
    rig.dispose()
    atlas.dispose()
  })
})
