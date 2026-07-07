import type { Distractor } from './distractors'
import { oppositeFace } from './cubeGeometry'
import { foldNet } from './foldMapper'
import type { CubeFace, DecoratedNet, FaceId, Hinge } from './types'

export interface OppositePair {
  readonly faces: readonly [FaceId, FaceId]
  /**
   * True when the pair also exhibits the Opposition Rule's syntactic pattern in the flat net:
   * two faces separated by exactly one face in a straight grid strip. Always geometrically
   * opposite regardless of this flag; the flag only says whether the quick visual shortcut
   * applies (vs. needing to actually trace the fold).
   */
  readonly syntactic: boolean
}

function cellsCollinearWithGap(a: readonly [number, number], b: readonly [number, number]): [number, number] | null {
  const dCol = b[0] - a[0]
  const dRow = b[1] - a[1]
  if (dCol === 0 && Math.abs(dRow) === 2) return [a[0], a[1] + dRow / 2]
  if (dRow === 0 && Math.abs(dCol) === 2) return [a[0] + dCol / 2, a[1]]
  return null
}

export function oppositePairs(net: DecoratedNet): OppositePair[] {
  const { plan } = foldNet(net)
  const cellByFaceId = new Map(net.faces.map((f) => [f.id, f.cell]))
  const cellOccupied = new Set(net.faces.map((f) => `${f.cell[0]},${f.cell[1]}`))

  const cubeFaceToFaceId = new Map<CubeFace, FaceId>()
  for (const face of net.faces) {
    cubeFaceToFaceId.set(plan.faceAssignment[face.id], face.id)
  }

  const seen = new Set<FaceId>()
  const pairs: OppositePair[] = []
  for (const face of net.faces) {
    if (seen.has(face.id)) continue
    const myCubeFace = plan.faceAssignment[face.id]
    const otherCubeFace = oppositeFace(myCubeFace)
    const otherFaceId = cubeFaceToFaceId.get(otherCubeFace)
    if (otherFaceId === undefined) throw new Error('internal error: opposite cube face has no assigned net face')
    seen.add(face.id)
    seen.add(otherFaceId)

    const cellA = cellByFaceId.get(face.id)
    const cellB = cellByFaceId.get(otherFaceId)
    let syntactic = false
    if (cellA && cellB) {
      const midpoint = cellsCollinearWithGap(cellA, cellB)
      syntactic = midpoint !== null && cellOccupied.has(`${midpoint[0]},${midpoint[1]}`)
    }

    pairs.push({ faces: [face.id, otherFaceId], syntactic })
  }
  return pairs
}

export function orientationTrace(net: DecoratedNet, faceId: FaceId): readonly Hinge[] {
  const { plan } = foldNet(net)
  const hingeByFace = new Map(plan.hinges.map((h) => [h.faceId, h]))
  const path: Hinge[] = []
  let current = faceId
  while (hingeByFace.has(current)) {
    const h = hingeByFace.get(current) as Hinge
    path.unshift(h)
    current = h.parentFaceId
  }
  return path
}

export type HeuristicRule = 'opposition' | 'orientation'

export interface RuleExplanation {
  readonly rule: HeuristicRule
  /** Net FaceIds implicated in the explanation (highlightable on both the net and the cube). */
  readonly witnessFaces: readonly FaceId[]
}

const OPPOSITION_KINDS = new Set(['opposite-swap', 'adjacent-permutation'])

export function explainDistractor(net: DecoratedNet, distractor: Distractor): RuleExplanation {
  const { plan } = foldNet(net)
  const cubeFaceToFaceId = new Map<CubeFace, FaceId>()
  for (const face of net.faces) {
    cubeFaceToFaceId.set(plan.faceAssignment[face.id], face.id)
  }

  const witnessFaces = distractor.affectedFaces.map((cf) => {
    const faceId = cubeFaceToFaceId.get(cf)
    if (faceId === undefined) throw new Error(`internal error: no net face assigned to cube face ${cf}`)
    return faceId
  })

  const rule: HeuristicRule = OPPOSITION_KINDS.has(distractor.kind) ? 'opposition' : 'orientation'
  return { rule, witnessFaces }
}
