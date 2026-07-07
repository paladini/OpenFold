import { createRng, foldNet, orientationTrace, type DecoratedNet, type FaceId } from '@openfold/core'
import { describe, expect, it } from 'vitest'
import { lesson } from './orientationRule.lesson'

function markedFaceId(net: DecoratedNet): FaceId {
  const match = /^face:(\d+)$/.exec((lesson.buildSteps(net)[0] as { kind: 'exposition'; callouts: readonly { anchor: string }[] }).callouts[0]?.anchor ?? '')
  if (!match) throw new Error('unreachable in test')
  return Number(match[1]) as FaceId
}

describe('orientationRule.lesson: makeProblem', () => {
  it('always yields a net with a non-4-fold decorated non-root face, over 100 rng states', () => {
    for (let seed = 0; seed < 100; seed++) {
      const net = lesson.makeProblem(createRng(seed))
      const faceId = markedFaceId(net)
      const face = net.faces.find((f) => f.id === faceId)
      expect(face?.symbol).not.toBeNull()
      expect(face?.symbol?.symmetry).not.toBe('4-fold')
      expect(orientationTrace(net, faceId).length).toBeGreaterThan(0)
    }
  })
})

describe.each([1, 2, 3])('orientationRule.lesson: seed %i', (seed) => {
  it("the final exposition step's displayed orientation equals foldNet's actual output", () => {
    const net = lesson.makeProblem(createRng(seed))
    const faceId = markedFaceId(net)
    const steps = lesson.buildSteps(net)
    const finalStep = steps[steps.length - 2] // last exposition step, right before practice
    expect(finalStep?.kind).toBe('exposition')
    if (finalStep?.kind !== 'exposition') return

    const { cube, plan } = foldNet(net)
    const expectedRotation = cube.faces[plan.faceAssignment[faceId]]?.rotation
    expect(finalStep.callouts[0]?.text(net)).toContain(`ends at ${expectedRotation} degrees`)
  })

  it("the practice question's correct answer equals foldNet's actual output", () => {
    const net = lesson.makeProblem(createRng(seed))
    const faceId = markedFaceId(net)
    const steps = lesson.buildSteps(net)
    const practice = steps[steps.length - 1]
    expect(practice?.kind).toBe('practice')
    if (practice?.kind !== 'practice') return

    const question = practice.makeQuestion(net)
    const chosenRotation = Number(question.options[question.correctIndex]?.replace(' degrees', ''))

    const { cube, plan } = foldNet(net)
    const expectedRotation = cube.faces[plan.faceAssignment[faceId]]?.rotation
    expect(chosenRotation).toBe(expectedRotation)
  })
})

describe('orientationRule.lesson: buildSteps', () => {
  it('has exactly one exposition callout per hinge on the face fold path', () => {
    const net = lesson.makeProblem(createRng(5))
    const faceId = markedFaceId(net)
    const trace = orientationTrace(net, faceId)
    const steps = lesson.buildSteps(net)

    // steps: [intro, ...one-per-hinge, final, practice]
    const perHingeSteps = steps.slice(1, 1 + trace.length)
    expect(perHingeSteps).toHaveLength(trace.length)
    for (const [i, step] of perHingeSteps.entries()) {
      expect(step.kind).toBe('exposition')
      if (step.kind !== 'exposition') continue
      expect(step.callouts[0]?.text(net)).toContain(`Fold ${i + 1}`)
    }
  })

  it('every per-hinge callout cites the correct axis and direction from orientationTrace', () => {
    const net = lesson.makeProblem(createRng(5))
    const faceId = markedFaceId(net)
    const trace = orientationTrace(net, faceId)
    const steps = lesson.buildSteps(net)
    const perHingeSteps = steps.slice(1, 1 + trace.length)

    for (const [i, step] of perHingeSteps.entries()) {
      if (step.kind !== 'exposition') continue
      const hinge = trace[i]
      const text = step.callouts[0]?.text(net) ?? ''
      expect(text).toContain(`${hinge?.axis}-axis`)
      expect(text).toContain(hinge && hinge.sign > 0 ? 'positive' : 'negative')
    }
  })

  it('all highlights and anchors reference only the marked face id', () => {
    const net = lesson.makeProblem(createRng(5))
    const faceId = markedFaceId(net)
    const steps = lesson.buildSteps(net)
    for (const step of steps) {
      if (step.kind !== 'exposition') continue
      for (const h of step.highlights) expect(h.id).toBe(String(faceId))
      for (const c of step.callouts) expect(c.anchor).toBe(`face:${faceId}`)
    }
  })
})
