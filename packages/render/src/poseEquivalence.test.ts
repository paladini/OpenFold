import { generateProblem } from '@openfold/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { ProblemScene, type MinimalRenderer } from './ProblemScene'
import { installFakeCanvasContext } from './testSupport/fakeCanvasContext'

beforeAll(() => {
  installFakeCanvasContext()
})

function makeFakeRenderer(canvas: HTMLCanvasElement): MinimalRenderer {
  return {
    domElement: canvas,
    setSize: () => {},
    setPixelRatio: () => {},
    render: () => {},
    dispose: () => {},
    info: { memory: { geometries: 1, textures: 1 } },
  }
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
  return el
}

/**
 * The full pose-equivalence verification (REND-01/REND-02): the exhaustive
 * computeFoldedState() vs. core.foldNet() cross-check across 300 seed/preset combinations lives
 * in ProblemScene.test.ts (co-located with the facade it verifies, per this package's test
 * convention). This file covers the remaining REND-01/REND-02 verification-depth requirement: the
 * scrub loop (setProgress called every frame while dragging a slider) must not allocate per call.
 */
describe('pose-equivalence: scrub loop allocation discipline', () => {
  it('setProgress does not grow the hinge/group count across repeated calls (no per-call allocation)', () => {
    const problem = generateProblem(1, 'hard')
    const scene = new ProblemScene()
    const container = makeContainer()
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })

    const netRig = (scene as unknown as { questionNetRig: { root: import('three').Group } }).questionNetRig
    const countObjects = (): number => {
      let count = 0
      netRig.root.traverse(() => {
        count++
      })
      return count
    }

    const before = countObjects()
    for (let i = 0; i < 500; i++) {
      scene.setProgress(i / 500)
    }
    const after = countObjects()

    expect(after).toBe(before)
    scene.dispose()
  })
})
