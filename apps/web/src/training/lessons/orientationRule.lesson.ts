import { foldNet, generateNet, orientationTrace, type CubeFaceState, type DecoratedNet, type FaceId, type GenerationParams, type Hinge, type Rng, type Rotation } from '@openfold/core'
import type { LessonScript, LessonStep } from '../lessonTypes'

const PARAMS: GenerationParams = { decoratedFaces: 5, symbolTier: 'orientation-sensitive', distractorMix: 'subtle', netBias: 'uniform' }
const MAX_ATTEMPTS = 32

/** A decorated, non-root face whose symbol actually shows rotation (not 4-fold, which looks identical after any 90-degree turn). */
function findOrientationFace(net: DecoratedNet): FaceId | null {
  const { plan } = foldNet(net)
  const hingeByFace = new Set(plan.hinges.map((h) => h.faceId))
  for (const face of net.faces) {
    if (face.symbol && face.symbol.symmetry !== '4-fold' && hingeByFace.has(face.id)) return face.id
  }
  return null
}

function makeProblem(rng: Rng): DecoratedNet {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const net = generateNet(rng.fork(`attempt-${attempt}`), PARAMS)
    if (findOrientationFace(net) !== null) return net
  }
  throw new Error(`orientationRule.lesson: exhausted ${MAX_ATTEMPTS} attempts finding an orientation-sensitive face`)
}

function requireFace(net: DecoratedNet): FaceId {
  const faceId = findOrientationFace(net)
  if (faceId === null) throw new Error('orientationRule.lesson: net has no orientation-sensitive face (should be unreachable -- makeProblem guarantees one)')
  return faceId
}

function finalFaceState(net: DecoratedNet, faceId: FaceId): CubeFaceState {
  const { cube, plan } = foldNet(net)
  const cubeFace = plan.faceAssignment[faceId]
  return cube.faces[cubeFace]
}

function hingeDeltaText(hinge: Hinge, index: number): string {
  const direction = hinge.sign > 0 ? 'positive' : 'negative'
  return `Fold ${index + 1}: rotates 90 degrees about the ${hinge.axis}-axis (${direction} direction) as face ${hinge.faceId} folds up from face ${hinge.parentFaceId}.`
}

function buildSteps(net: DecoratedNet): readonly LessonStep[] {
  const faceId = requireFace(net)
  const trace = orientationTrace(net, faceId)
  const highlight = [{ kind: 'face' as const, id: String(faceId) }]
  const netFace = net.faces.find((f) => f.id === faceId)
  const startRotation: Rotation = netFace?.symbolRotation ?? 0

  const traceSteps: LessonStep[] = trace.map((hinge, i) => ({
    kind: 'exposition',
    foldProgress: (i + 1) / (trace.length + 1),
    highlights: highlight,
    callouts: [{ anchor: `face:${faceId}`, text: () => hingeDeltaText(hinge, i) }],
  }))

  return [
    {
      kind: 'exposition',
      foldProgress: 0,
      highlights: highlight,
      callouts: [{ anchor: `face:${faceId}`, text: () => `Face ${faceId} carries an orientation-sensitive symbol, drawn here at ${startRotation} degrees on the flat net. Watch it as each fold carries it along.` }],
    },
    ...traceSteps,
    {
      kind: 'exposition',
      foldProgress: 1,
      highlights: highlight,
      callouts: [
        {
          anchor: `face:${faceId}`,
          text: (n) => {
            const final = finalFaceState(n, faceId)
            return `Net-to-cube delta: face ${faceId} started at ${startRotation} degrees on the net and ends at ${final.rotation} degrees on the cube, after ${trace.length} fold${trace.length === 1 ? '' : 's'}.`
          },
        },
      ],
    },
    {
      kind: 'practice',
      prompt: () => `What is face ${faceId}'s final orientation on the folded cube?`,
      makeQuestion: (n) => {
        const qFaceId = requireFace(n)
        const final = finalFaceState(n, qFaceId)
        const rotationChoices: readonly Rotation[] = [0, 90, 180, 270]
        const options = rotationChoices.map((r) => `${r} degrees`)
        const correctIndex = rotationChoices.indexOf(final.rotation)
        return {
          prompt: `What is face ${qFaceId}'s final orientation on the folded cube?`,
          options,
          correctIndex,
          justify: () => ({
            text: `Retracing face ${qFaceId}'s ${orientationTrace(n, qFaceId).length} folds from the net gives a final orientation of ${final.rotation} degrees.`,
            highlights: [{ kind: 'face', id: String(qFaceId) }],
          }),
        }
      },
      justification: 'orientationTrace',
    },
  ]
}

export const lesson: LessonScript = {
  id: 'orientation-rule',
  title: 'The Orientation Rule',
  estMinutes: 4,
  makeProblem,
  buildSteps,
}
