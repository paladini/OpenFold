import { CANONICAL_NETS, type CanonicalNet, foldNet, type DecoratedNet, type FaceId, type NetFace } from '@openfold/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { Mesh, Vector3 } from 'three'
import { buildNet } from './NetBuilder'
import { SymbolAtlas } from './SymbolAtlas'
import { installFakeCanvasContext } from './testSupport/fakeCanvasContext'

beforeAll(() => {
  installFakeCanvasContext()
})

const GLYPHS = ['arrow', 'flag', 'l-shape', 'boot', 'key', 'lightning']

function buildFixtureNet(canonical: CanonicalNet): DecoratedNet {
  const faces: NetFace[] = canonical.cells.map((cell, i) => ({
    id: i as FaceId,
    cell,
    symbol: { glyphId: GLYPHS[i] as string, symmetry: 'asymmetric', mirrored: false },
    symbolRotation: 0,
  }))
  return {
    netId: canonical.id,
    symmetryOp: 0,
    faces,
    adjacency: canonical.adjacency.map(([a, b]) => [a as FaceId, b as FaceId]),
  }
}

describe('buildNet: hierarchy structure', () => {
  it('has exactly one pivot group per FoldPlan hinge, matching parent/child edges exactly', () => {
    const net = buildFixtureNet(CANONICAL_NETS[6] as CanonicalNet)
    const { plan } = foldNet(net)
    const atlas = new SymbolAtlas()
    const rig = buildNet(net, plan, atlas)

    expect(rig.hinges).toHaveLength(plan.hinges.length)
    const rigFaceIds = new Set(rig.hinges.map((h) => h.faceId))
    const planFaceIds = new Set(plan.hinges.map((h) => h.faceId))
    expect(rigFaceIds).toEqual(planFaceIds)

    for (const hinge of rig.hinges) {
      const planHinge = plan.hinges.find((h) => h.faceId === hinge.faceId)
      expect(planHinge).toBeDefined()
      expect(hinge.axis).toBe(planHinge?.axis)
      expect(hinge.sign).toBe(planHinge?.sign)
    }

    rig.dispose()
    atlas.dispose()
  })

  it('produces exactly one mesh per net face', () => {
    const net = buildFixtureNet(CANONICAL_NETS[6] as CanonicalNet)
    const { plan } = foldNet(net)
    const atlas = new SymbolAtlas()
    const rig = buildNet(net, plan, atlas)

    expect(rig.faceMeshes.size).toBe(6)
    for (const face of net.faces) {
      expect(rig.faceMeshes.has(face.id)).toBe(true)
    }

    rig.dispose()
    atlas.dispose()
  })
})

describe('buildNet: flat (unfolded) pose', () => {
  it('at hinge angle 0, every face mesh sits at its own flat grid cell center', () => {
    const net = buildFixtureNet(CANONICAL_NETS[6] as CanonicalNet)
    const { plan } = foldNet(net)
    const atlas = new SymbolAtlas()
    const rig = buildNet(net, plan, atlas)

    rig.root.updateMatrixWorld(true)
    const worldPos = new Vector3()
    for (const face of net.faces) {
      const mesh = rig.faceMeshes.get(face.id)
      expect(mesh).toBeDefined()
      mesh?.getWorldPosition(worldPos)
      expect(worldPos.x).toBeCloseTo(face.cell[0] + 0.5)
      expect(worldPos.y).toBeCloseTo(face.cell[1] + 0.5)
      expect(worldPos.z).toBeCloseTo(0)
    }

    rig.dispose()
    atlas.dispose()
  })

  it('[PBT-like sweep] holds across all 11 canonical nets', () => {
    const atlas = new SymbolAtlas()
    for (const canonical of CANONICAL_NETS) {
      const net = buildFixtureNet(canonical)
      const { plan } = foldNet(net)
      const rig = buildNet(net, plan, atlas)
      rig.root.updateMatrixWorld(true)
      const worldPos = new Vector3()
      for (const face of net.faces) {
        const mesh = rig.faceMeshes.get(face.id) as Mesh
        mesh.getWorldPosition(worldPos)
        expect(worldPos.x).toBeCloseTo(face.cell[0] + 0.5)
        expect(worldPos.y).toBeCloseTo(face.cell[1] + 0.5)
      }
      rig.dispose()
    }
    atlas.dispose()
  })
})

describe('buildNet: UV assignment', () => {
  it('assigns UVs matching the atlas region for each face glyph + rotation', () => {
    const net = buildFixtureNet(CANONICAL_NETS[6] as CanonicalNet)
    const { plan } = foldNet(net)
    const atlas = new SymbolAtlas()
    const rig = buildNet(net, plan, atlas)

    for (const face of net.faces) {
      const mesh = rig.faceMeshes.get(face.id)
      const uvAttr = mesh?.geometry.getAttribute('uv')
      expect(uvAttr).toBeDefined()
      if (!face.symbol || !uvAttr) continue
      const region = atlas.getUv(face.symbol.glyphId, face.symbolRotation)
      // first UV pair corresponds to bottom-left of the quad
      expect(uvAttr.getX(0)).toBeCloseTo(region.u0)
      expect(uvAttr.getY(0)).toBeCloseTo(region.v0)
    }

    rig.dispose()
    atlas.dispose()
  })

  it('blank (undecorated) faces still get a valid quad UV without throwing', () => {
    const canonical = CANONICAL_NETS[6] as CanonicalNet
    const faces: NetFace[] = canonical.cells.map((cell, i) => ({
      id: i as FaceId,
      cell,
      symbol: null,
      symbolRotation: 0,
    }))
    const net: DecoratedNet = {
      netId: canonical.id,
      symmetryOp: 0,
      faces,
      adjacency: canonical.adjacency.map(([a, b]) => [a as FaceId, b as FaceId]),
    }
    const { plan } = foldNet(net)
    const atlas = new SymbolAtlas()
    expect(() => buildNet(net, plan, atlas)).not.toThrow()
    atlas.dispose()
  })
})
