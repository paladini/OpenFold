import { createRng, oppositePairs } from '@openfold/core'
import { describe, expect, it } from 'vitest'
import { lesson } from './oppositionRule.lesson'

describe('oppositionRule.lesson: makeProblem', () => {
  it('always yields a net with a syntactic strip pattern, over 100 rng states', () => {
    for (let seed = 0; seed < 100; seed++) {
      const net = lesson.makeProblem(createRng(seed))
      const hasSyntacticPair = oppositePairs(net).some((p) => p.syntactic)
      expect(hasSyntacticPair).toBe(true)
    }
  })
})

describe('oppositionRule.lesson: buildSteps', () => {
  it('every highlight and callout anchor references a face id present in the net', () => {
    const net = lesson.makeProblem(createRng(7))
    const validFaceIds = new Set(net.faces.map((f) => f.id))
    const steps = lesson.buildSteps(net)

    for (const step of steps) {
      if (step.kind !== 'exposition') continue
      for (const h of step.highlights) {
        if (h.kind === 'face') expect(validFaceIds.has(Number(h.id) as never)).toBe(true)
      }
      for (const c of step.callouts) {
        const match = /^face:(\d+)$/.exec(c.anchor)
        expect(match).not.toBeNull()
        expect(validFaceIds.has(Number(match?.[1]) as never)).toBe(true)
      }
    }
  })

  it('the exposition steps highlight the two syntactic-pair faces plus the face between them', () => {
    const net = lesson.makeProblem(createRng(3))
    const steps = lesson.buildSteps(net)
    const first = steps[0]
    expect(first?.kind).toBe('exposition')
    if (first?.kind !== 'exposition') return
    expect(first.highlights).toHaveLength(3)
  })

  it('the final exposition step restates the rule formally', () => {
    const net = lesson.makeProblem(createRng(3))
    const steps = lesson.buildSteps(net)
    const foldedStep = steps[2]
    expect(foldedStep?.kind).toBe('exposition')
    if (foldedStep?.kind !== 'exposition') return
    expect(foldedStep.foldProgress).toBe(1)
    expect(foldedStep.callouts[0]?.text(net)).toMatch(/Opposition Rule/)
  })
})

describe("oppositionRule.lesson: practice question's correct answer", () => {
  it.each([1, 2, 3])('matches core.oppositePairs for seed %i', (seed) => {
    const net = lesson.makeProblem(createRng(seed))
    const steps = lesson.buildSteps(net)
    const practice = steps[steps.length - 1]
    expect(practice?.kind).toBe('practice')
    if (practice?.kind !== 'practice') return

    const question = practice.makeQuestion(net)
    const chosenLabel = question.options[question.correctIndex]
    const chosenFaceId = Number(chosenLabel?.replace('Face ', ''))

    const promptFaceId = Number(/face (\d+)/.exec(practice.prompt(net))?.[1])
    const pair = oppositePairs(net).find((p) => p.faces.includes(promptFaceId as never))
    expect(pair).toBeDefined()
    const expectedOpposite = pair?.faces.find((f) => f !== promptFaceId)
    expect(chosenFaceId).toBe(expectedOpposite)
  })
})
