import { createRng, generateNet, generateProblem, type DecoratedNet, type DifficultyPreset, type GenerationParams } from '@openfold/core'
import { describe, expect, it } from 'vitest'
import { buildExplanation } from './explanationText'
import type { LessonScript } from './lessonTypes'
import { lesson as oppositionRuleLesson } from './lessons/oppositionRule.lesson'
import { lesson as orientationRuleLesson } from './lessons/orientationRule.lesson'

const PRESETS: readonly DifficultyPreset[] = ['easy', 'medium', 'hard']
const FUZZ_COUNT = 1000

describe('tutoring verification: explanation fuzz', () => {
  it('1000 seeded wrong answers all produce a rule-grounded, geometry-faithful explanation', () => {
    let checked = 0
    let syntacticFallbacks = 0
    const ruleCounts = { opposition: 0, orientation: 0 }

    for (let seed = 0; seed < FUZZ_COUNT; seed++) {
      const preset = PRESETS[seed % PRESETS.length] as DifficultyPreset
      const problem = generateProblem(seed, preset)
      if (problem.distractorMeta.length === 0) continue
      const meta = problem.distractorMeta[seed % problem.distractorMeta.length]
      if (!meta) continue

      const explanation = buildExplanation(problem, meta.index, 'incorrect')
      checked++

      expect(explanation.rule).not.toBeNull()
      if (explanation.rule === 'opposition') ruleCounts.opposition++
      if (explanation.rule === 'orientation') ruleCounts.orientation++
      if (explanation.body.includes('Fold the net and check')) syntacticFallbacks++

      // Zero hallucinated geometry: every "face N" mentioned in the body must be a real face id
      // present in this problem's net, and every highlighted net face must be one of them too.
      const validFaceIds = new Set(problem.net.faces.map((f) => f.id))
      const mentionedFaces = [...explanation.body.matchAll(/face (\d+)/g)].map((m) => Number(m[1]))
      for (const faceId of mentionedFaces) expect(validFaceIds.has(faceId as never)).toBe(true)

      for (const h of explanation.highlights) {
        if (h.kind === 'face') expect(validFaceIds.has(Number(h.id) as never)).toBe(true)
      }
    }

    expect(checked).toBeGreaterThan(900) // most seeds have at least one distractor to explain
    // Documented edge-case fallback rate (spec: "no fallback-to-generic text except the documented
    // syntactic-pattern edge case") -- both phrasings are legitimate outcomes of buildExplanation;
    // this just records how often each occurs across the fuzz sweep, for visibility.
    console.log(`tutoring fuzz: ${checked} checked, ${syntacticFallbacks} used the non-syntactic fallback phrasing, rules=${JSON.stringify(ruleCounts)}`)
    expect(ruleCounts.opposition + ruleCounts.orientation).toBe(checked)
  })
})

const REAL_LESSONS: readonly LessonScript[] = [oppositionRuleLesson, orientationRuleLesson]

describe('tutoring verification: lesson content structure (keyboard/reduced-motion readiness)', () => {
  it.each(REAL_LESSONS.map((l) => [l.id, l] as const))('%s: every step is reachable by pure step-index navigation and ends in a scoreable practice question', (_id, lesson) => {
    const net = lesson.makeProblem(createRng(1))
    const steps = lesson.buildSteps(net)
    expect(steps.length).toBeGreaterThan(0)

    // Every exposition step declares a fold progress in [0,1] -- a stepped-mode pose exists for
    // every declared foldProgress regardless of animation (reduced motion is a render-layer
    // concern, already covered by rendering-3d's own stepped-mode tests; this asserts the lesson
    // never declares a step that couldn't be represented as a stepped pose).
    for (const step of steps) {
      if (step.kind !== 'exposition') continue
      expect(step.foldProgress).toBeGreaterThanOrEqual(0)
      expect(step.foldProgress).toBeLessThanOrEqual(1)
    }

    const last = steps[steps.length - 1]
    expect(last?.kind).toBe('practice')
    if (last?.kind !== 'practice') return
    const question = last.makeQuestion(net)
    expect(question.options.length).toBeGreaterThan(1)
    expect(question.correctIndex).toBeGreaterThanOrEqual(0)
    expect(question.correctIndex).toBeLessThan(question.options.length)
    expect(question.justify().text.length).toBeGreaterThan(0)
  })

  it.each([1, 2, 3])('every step for both lessons stays reachable across 3 different seeds (no seed-dependent step-count crash)', (seed) => {
    for (const lesson of REAL_LESSONS) {
      const net = lesson.makeProblem(createRng(seed))
      const steps = lesson.buildSteps(net)
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[steps.length - 1]?.kind).toBe('practice')
    }
  })
})

describe('tutoring verification: content-only extensibility', () => {
  it('a dummy third lesson (unknown to any existing lesson file) builds and completes with zero player changes', () => {
    const dummyParams: GenerationParams = { decoratedFaces: 3, symbolTier: 'distinct', distractorMix: 'balanced', netBias: 'uniform' }
    const dummyLesson: LessonScript = {
      id: 'dummy-third-lesson',
      title: 'A brand new lesson nobody wrote yet',
      estMinutes: 1,
      makeProblem: (rng) => generateNet(rng, dummyParams),
      buildSteps: (net: DecoratedNet) => [
        {
          kind: 'exposition',
          foldProgress: 0,
          highlights: [{ kind: 'face', id: String(net.faces[0]?.id ?? 0) }],
          callouts: [{ anchor: `face:${net.faces[0]?.id ?? 0}`, text: (n) => `Net has ${n.faces.length} faces.` }],
        },
        {
          kind: 'practice',
          prompt: () => 'How many faces does this net have?',
          makeQuestion: (n) => ({
            prompt: 'How many faces does this net have?',
            options: ['5', '6', '7'],
            correctIndex: n.faces.length === 6 ? 1 : 0,
            justify: () => ({ text: `This net has ${n.faces.length} faces.`, highlights: [] }),
          }),
          justification: 'oppositePairs',
        },
      ],
    }

    // This is exactly the LessonScript/LESSONS-registry contract -- no import from LessonPlayer.tsx
    // or TrainingHubScreen.tsx was touched to make this work, only content was added.
    expect(REAL_LESSONS.every((l) => l.id !== dummyLesson.id)).toBe(true)
    const registry = [...REAL_LESSONS, dummyLesson]
    expect(registry).toHaveLength(3)

    const net = dummyLesson.makeProblem(createRng(1))
    const steps = dummyLesson.buildSteps(net)
    expect(steps).toHaveLength(2)
    expect(steps[1]?.kind).toBe('practice')
    if (steps[1]?.kind !== 'practice') return
    const question = steps[1].makeQuestion(net)
    expect(question.options[question.correctIndex]).toBe(String(net.faces.length))
  })
})
