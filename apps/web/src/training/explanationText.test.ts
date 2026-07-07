import { generateProblem, oppositePairs, type DifficultyPreset, type FaceId, type FoldProblem, type PerturbationKind } from '@openfold/core'
import { describe, expect, it } from 'vitest'
import { buildExplanation } from './explanationText'

function findWithKind(kind: PerturbationKind, preset: DifficultyPreset, maxSeed = 400): { problem: FoldProblem; index: number } {
  for (let seed = 0; seed < maxSeed; seed++) {
    const problem = generateProblem(seed, preset)
    const meta = problem.distractorMeta.find((m) => m.kind === kind)
    if (meta) return { problem, index: meta.index }
  }
  throw new Error(`no seed under ${maxSeed} produced a ${kind} distractor at preset ${preset}`)
}

function witnessFacesOf(problem: FoldProblem, index: number): readonly FaceId[] {
  const cubeFaceToFaceId = new Map(problem.net.faces.map((f) => [problem.plan.faceAssignment[f.id], f.id]))
  const meta = problem.distractorMeta.find((m) => m.index === index)
  if (!meta) throw new Error('unreachable in test fixture')
  return meta.affectedFaces.map((cf) => {
    const id = cubeFaceToFaceId.get(cf)
    if (id === undefined) throw new Error('unreachable in test fixture')
    return id
  })
}

describe('buildExplanation: opposite-swap', () => {
  it('cites the Opposition Rule and mentions only the witness pair', () => {
    const { problem, index } = findWithKind('opposite-swap', 'easy')
    const witness = witnessFacesOf(problem, index)
    const explanation = buildExplanation(problem, index, 'incorrect')

    expect(explanation.rule).toBe('opposition')
    expect(explanation.headline).toBe('Opposition Rule')
    for (const f of witness) expect(explanation.body).toContain(`face ${f}`)
    // No other face id should appear as "face N" text unless it's also a witness face.
    for (const face of problem.net.faces) {
      if (!witness.includes(face.id)) expect(explanation.body).not.toContain(`face ${face.id}`)
    }
  })

  it('highlights exactly the witness pair on both the net and the chosen cube', () => {
    const { problem, index } = findWithKind('opposite-swap', 'easy')
    const witness = witnessFacesOf(problem, index)
    const explanation = buildExplanation(problem, index, 'incorrect')

    expect(explanation.highlights).toHaveLength(witness.length * 2)
    const netIds = explanation.highlights.filter((h) => h.kind === 'face').map((h) => h.id)
    expect(netIds.sort()).toEqual(witness.map(String).sort())
    const cubeIds = explanation.highlights.filter((h) => h.kind === 'cubeFace').map((h) => h.id)
    expect(cubeIds).toHaveLength(witness.length)
    expect(cubeIds.every((id) => id.startsWith(`${index}:face:`))).toBe(true)
  })

  it('uses the strip-pattern phrasing when the witness pair is syntactic', () => {
    for (let seed = 0; seed < 400; seed++) {
      const problem = generateProblem(seed, 'easy')
      const meta = problem.distractorMeta.find((m) => m.kind === 'opposite-swap')
      if (!meta) continue
      const witness = witnessFacesOf(problem, meta.index)
      const pair = oppositePairs(problem.net).find((p) => p.faces.includes(witness[0] as FaceId) && p.faces.includes(witness[1] as FaceId))
      if (!pair?.syntactic) continue
      const explanation = buildExplanation(problem, meta.index, 'incorrect')
      expect(explanation.body).toContain('straight strip')
      return
    }
    throw new Error('no syntactic opposite-swap fixture found under 400 seeds')
  })

  it('falls back to fold-based phrasing when the witness pair is not syntactic (spec edge case)', () => {
    for (let seed = 0; seed < 400; seed++) {
      const problem = generateProblem(seed, 'easy')
      const meta = problem.distractorMeta.find((m) => m.kind === 'opposite-swap')
      if (!meta) continue
      const witness = witnessFacesOf(problem, meta.index)
      const pair = oppositePairs(problem.net).find((p) => p.faces.includes(witness[0] as FaceId) && p.faces.includes(witness[1] as FaceId))
      if (pair?.syntactic !== false) continue
      const explanation = buildExplanation(problem, meta.index, 'incorrect')
      expect(explanation.body).toContain('Fold the net and check')
      expect(explanation.body).not.toContain('straight strip')
      return
    }
    throw new Error('no non-syntactic opposite-swap fixture found under 400 seeds')
  })
})

describe('buildExplanation: adjacent-permutation', () => {
  it('cites the Opposition Rule and mentions all three witness faces', () => {
    const { problem, index } = findWithKind('adjacent-permutation', 'easy')
    const witness = witnessFacesOf(problem, index)
    const explanation = buildExplanation(problem, index, 'incorrect')

    expect(explanation.rule).toBe('opposition')
    expect(witness).toHaveLength(3)
    for (const f of witness) expect(explanation.body).toContain(`face ${f}`)
  })
})

describe('buildExplanation: symbol-rotation', () => {
  it('cites the Orientation Rule and mentions the witness face and its fold count', () => {
    const { problem, index } = findWithKind('symbol-rotation', 'hard')
    const witness = witnessFacesOf(problem, index)
    const explanation = buildExplanation(problem, index, 'incorrect')

    expect(explanation.rule).toBe('orientation')
    expect(explanation.headline).toBe('Orientation Rule')
    expect(witness).toHaveLength(1)
    expect(explanation.body).toContain(`face ${witness[0]}`)
    expect(explanation.body).toMatch(/\d+ folds?/)
  })
})

describe('buildExplanation: symbol-mirror', () => {
  it('cites the Orientation Rule and mentions the witness face and mirroring', () => {
    const { problem, index } = findWithKind('symbol-mirror', 'hard')
    const witness = witnessFacesOf(problem, index)
    const explanation = buildExplanation(problem, index, 'incorrect')

    expect(explanation.rule).toBe('orientation')
    expect(explanation.body).toContain(`face ${witness[0]}`)
    expect(explanation.body.toLowerCase()).toContain('mirror')
  })
})

describe('buildExplanation: correct and timeout outcomes', () => {
  it('correct: compact reminder citing a rule, no highlights', () => {
    const problem = generateProblem(1, 'medium')
    const explanation = buildExplanation(problem, problem.correctIndex, 'correct')
    expect(explanation.headline).toBe('Correct')
    expect(['opposition', 'orientation']).toContain(explanation.rule)
    expect(explanation.highlights).toEqual([])
  })

  it('timeout: highlights the correct cube and cites a strategy rule', () => {
    const problem = generateProblem(1, 'medium')
    const explanation = buildExplanation(problem, null, 'timeout')
    expect(explanation.headline).toBe("Time's up")
    expect(explanation.highlights).toEqual([{ kind: 'cubeFace', id: `${problem.correctIndex}:face:+z` }])
  })
})

describe('buildExplanation: defensive fallback', () => {
  it('an incorrect outcome with no matching distractor meta (e.g. chosen the correct index) falls back safely', () => {
    const problem = generateProblem(1, 'medium')
    const explanation = buildExplanation(problem, problem.correctIndex, 'incorrect')
    expect(explanation.rule).toBeNull()
  })
})
