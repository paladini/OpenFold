import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { oppositeFace, upVectorToRotation } from './cubeGeometry'
import type { Distractor } from './distractors'
import { explainDistractor, oppositePairs, orientationTrace } from './heuristics'
import { foldNet } from './foldMapper'
import { CANONICAL_NETS, type CanonicalNet } from './netCatalog'
import { apply, composeScrew, hingeRotation, IDENTITY, type ScrewMotion } from './intMath'
import type { DecoratedNet, FaceId, NetFace } from './types'

function buildNet(canonical: CanonicalNet): DecoratedNet {
  const faces: NetFace[] = canonical.cells.map((cell, i) => ({
    id: i as FaceId,
    cell,
    symbol: { glyphId: `g${i}`, symmetry: 'asymmetric', mirrored: false },
    symbolRotation: 0,
  }))
  return {
    netId: canonical.id,
    symmetryOp: 0,
    faces,
    adjacency: canonical.adjacency.map(([a, b]) => [a as FaceId, b as FaceId]),
  }
}

describe('oppositePairs', () => {
  it('[PBT] for every canonical net, every pair is confirmed antipodal by the fold mapper', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: CANONICAL_NETS.length - 1 }), (idx) => {
        const net = buildNet(CANONICAL_NETS[idx] as CanonicalNet)
        const { plan } = foldNet(net)
        const pairs = oppositePairs(net)

        expect(pairs).toHaveLength(3)
        const seen = new Set<FaceId>()
        for (const pair of pairs) {
          const [a, b] = pair.faces
          expect(plan.faceAssignment[b]).toBe(oppositeFace(plan.faceAssignment[a]))
          seen.add(a)
          seen.add(b)
        }
        expect(seen.size).toBe(6) // every face appears in exactly one pair
      }),
    )
  })

  it('flags a genuine straight-strip pattern as syntactic (net #0, faces 0 & 5)', () => {
    // net #0 cells: face0=(1,0) ... face2=(1,1) ... face5=(1,2) -- a vertical 3-in-a-row strip,
    // so face0 and face5 are separated by exactly face2 in a straight line.
    const net = buildNet(CANONICAL_NETS[0] as CanonicalNet)
    const pairs = oppositePairs(net)
    const pair05 = pairs.find((p) => p.faces.includes(0) && p.faces.includes(5))
    expect(pair05).toBeDefined()
    expect(pair05?.syntactic).toBe(true)
  })

  it('does not flag a fold-opposite pair with no straight-strip pattern as syntactic (net #1, faces 0 & 5)', () => {
    // net #1 cells: face0=(2,0), face5=(1,2) -- not collinear at all, yet still fold-opposite.
    const net = buildNet(CANONICAL_NETS[1] as CanonicalNet)
    const pairs = oppositePairs(net)
    const pair05 = pairs.find((p) => p.faces.includes(0) && p.faces.includes(5))
    expect(pair05).toBeDefined()
    expect(pair05?.syntactic).toBe(false)
  })
})

describe('orientationTrace', () => {
  it('returns an empty trace for the root face', () => {
    const net = buildNet(CANONICAL_NETS[6] as CanonicalNet)
    const { plan } = foldNet(net)
    expect(orientationTrace(net, plan.rootFace)).toEqual([])
  })

  it('[PBT] composing the hinge trace reproduces the same final orientation as foldNet', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: CANONICAL_NETS.length - 1 }),
        fc.integer({ min: 0, max: 5 }),
        (netIdx, faceIdx) => {
          const canonical = CANONICAL_NETS[netIdx] as CanonicalNet
          // All symbolRotation=0 (via buildNet), so a face's stored CubeState rotation IS exactly
          // the fold-induced rotation -- the same quantity the trace should reproduce.
          const net = buildNet(canonical)
          const faceId = faceIdx as FaceId
          const trace = orientationTrace(net, faceId)

          // Matches foldMapper's own accumulation order exactly: mul(accumulatedSoFar, newLocalHinge)
          // -- the newest hinge is the inner (applied-first) motion, the running total is outer.
          let motion: ScrewMotion = { rotation: IDENTITY, translation: [0, 0, 0] }
          for (const hinge of trace) {
            const step = hingeRotation(hinge.axis, hinge.pivot, hinge.sign)
            motion = composeScrew(motion, step)
          }
          // Directions (unlike points) transform by the rotation component only -- no translation.
          const replayedUp = apply(motion.rotation, [0, 1, 0])

          const { cube, plan } = foldNet(net)
          const cubeFace = plan.faceAssignment[faceId]
          const replayedRotation = upVectorToRotation(cubeFace, replayedUp)
          expect(replayedRotation).toBe(cube.faces[cubeFace].rotation)
        },
      ),
    )
  })

  it('hinge trace length equals the face depth in the spanning tree', () => {
    const net = buildNet(CANONICAL_NETS[6] as CanonicalNet)
    // net #6: face5 is 3 hinges deep from root (face0 -> face1 -> face3 -> face4 -> face5, but
    // face1 is root's only child, then face3, face4, face5 chain down) -- verify via hinges list.
    const { plan } = foldNet(net)
    const depthOf = (faceId: FaceId): number => {
      let depth = 0
      let current = faceId
      const hingeByFace = new Map(plan.hinges.map((h) => [h.faceId, h]))
      while (hingeByFace.has(current)) {
        depth++
        current = (hingeByFace.get(current) as (typeof plan.hinges)[number]).parentFaceId
      }
      return depth
    }
    for (const face of net.faces) {
      expect(orientationTrace(net, face.id)).toHaveLength(depthOf(face.id))
    }
  })
})

describe('explainDistractor', () => {
  const net = buildNet(CANONICAL_NETS[6] as CanonicalNet)
  const { plan } = foldNet(net)

  it("attributes opposite-swap to the 'opposition' rule and names the correct witness net faces", () => {
    const faceA = plan.faceAssignment[0]
    const faceB = plan.faceAssignment[2]
    const distractor: Distractor = { cube: foldNet(net).cube, kind: 'opposite-swap', affectedFaces: [faceA, faceB] }
    const explanation = explainDistractor(net, distractor)
    expect(explanation.rule).toBe('opposition')
    expect(new Set(explanation.witnessFaces)).toEqual(new Set([0, 2]))
  })

  it("attributes adjacent-permutation to the 'opposition' rule", () => {
    const distractor: Distractor = {
      cube: foldNet(net).cube,
      kind: 'adjacent-permutation',
      affectedFaces: [plan.faceAssignment[0], plan.faceAssignment[1], plan.faceAssignment[3]],
    }
    expect(explainDistractor(net, distractor).rule).toBe('opposition')
  })

  it("attributes symbol-rotation to the 'orientation' rule", () => {
    const distractor: Distractor = { cube: foldNet(net).cube, kind: 'symbol-rotation', affectedFaces: [plan.faceAssignment[1]] }
    const explanation = explainDistractor(net, distractor)
    expect(explanation.rule).toBe('orientation')
    expect(explanation.witnessFaces).toEqual([1])
  })

  it("attributes symbol-mirror to the 'orientation' rule", () => {
    const distractor: Distractor = { cube: foldNet(net).cube, kind: 'symbol-mirror', affectedFaces: [plan.faceAssignment[4]] }
    expect(explainDistractor(net, distractor).rule).toBe('orientation')
  })
})
