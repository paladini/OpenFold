import { foldNet, generateProblem } from '@openfold/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { ProblemScene, type MinimalRenderer } from './ProblemScene'
import { installFakeCanvasContext } from './testSupport/fakeCanvasContext'

beforeAll(() => {
  installFakeCanvasContext()
  // jsdom doesn't implement the Pointer Capture API; OrbitControls calls it on pointerdown.
  const proto = HTMLElement.prototype as unknown as { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void }
  proto.setPointerCapture ??= () => {}
  proto.releasePointerCapture ??= () => {}
})

function makeFakeRenderer(canvas: HTMLCanvasElement): MinimalRenderer {
  let disposed = false
  return {
    domElement: canvas,
    setSize: () => {},
    setPixelRatio: () => {},
    render: () => {},
    dispose: () => {
      disposed = true
    },
    get info() {
      return { memory: { geometries: disposed ? 0 : 1, textures: disposed ? 0 : 1 } }
    },
  }
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
  return el
}

describe('ProblemScene: pose-equivalence (anti-divergence contract)', () => {
  it('computeFoldedState() matches core.foldNet(problem.net).cube across all three presets', () => {
    for (const preset of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 0; seed < 100; seed++) {
        const problem = generateProblem(seed, preset)
        const scene = new ProblemScene()
        const container = makeContainer()
        scene.mount(container, problem, { createRenderer: makeFakeRenderer })
        scene.setProgress(1)

        const rendered = scene.computeFoldedState()
        const { cube: expected } = foldNet(problem.net)
        expect(rendered).toEqual(expected)

        scene.dispose()
      }
    }
  })
})

describe('ProblemScene: lifecycle', () => {
  it('double-mount supersedes cleanly (no orphaned canvas)', () => {
    const problem = generateProblem(1, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    scene.dispose()
  })

  it('dispose() zeroes the renderer memory counters', () => {
    const problem = generateProblem(2, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    let capturedRenderer: MinimalRenderer | null = null
    scene.mount(container, problem, {
      createRenderer: (canvas) => {
        capturedRenderer = makeFakeRenderer(canvas)
        return capturedRenderer
      },
    })
    const renderer = capturedRenderer as MinimalRenderer | null
    expect(renderer?.info.memory.geometries).toBeGreaterThan(0)
    scene.dispose()
    expect(renderer?.info.memory.geometries).toBe(0)
  })

  it('resize() updates the camera aspect ratio and calls renderer.setSize with new dimensions', () => {
    const problem = generateProblem(3, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    let sizeCalls: Array<[number, number]> = []
    scene.mount(container, problem, {
      createRenderer: (canvas) => {
        const renderer = makeFakeRenderer(canvas)
        return {
          ...renderer,
          setSize: (w: number, h: number) => {
            sizeCalls.push([w, h])
          },
        }
      },
    })
    sizeCalls = [] // clear the initial mount-time call
    Object.defineProperty(container, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 300, configurable: true })
    scene.resize()
    expect(sizeCalls).toEqual([[400, 300]])
    scene.dispose()
  })
})

describe('ProblemScene: selection wiring', () => {
  // Picker's own raycast/keyboard-selection correctness is covered exhaustively in
  // Picker.test.ts; this only verifies ProblemScene's onSelect subscription plumbing itself.
  it('onSelect registers and unsubscribes without throwing across mount/dispose', () => {
    const problem = generateProblem(4, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })

    const selected: number[] = []
    const unsubscribe = scene.onSelect((i) => selected.push(i))
    expect(typeof unsubscribe).toBe('function')
    expect(() => unsubscribe()).not.toThrow()
    scene.dispose()
  })

  it('a real pointerdown event on the canvas at an answer cube selects it', () => {
    const problem = generateProblem(6, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect

    // Answer cube index 2 sits at world x=0, y=ANSWER_Y, z=0 (see ProblemScene's own layout
    // constants); project it through the same camera to get its expected client coordinates.
    const camera = (scene as unknown as { camera: import('three').PerspectiveCamera }).camera
    const answerRigs = (scene as unknown as { answerRigs: Array<{ group: import('three').Group }> }).answerRigs
    const worldPos = answerRigs[2]?.group.position.clone() as import('three').Vector3
    const ndc = worldPos.project(camera)
    const clientX = ((ndc.x + 1) / 2) * 800
    const clientY = ((1 - ndc.y) / 2) * 600

    const selected: number[] = []
    scene.onSelect((i) => selected.push(i))
    // jsdom doesn't implement PointerEvent; MouseEvent carries the same clientX/clientY the
    // handler reads, and listener dispatch matches on the event type string either way.
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX, clientY, bubbles: true }))
    expect(selected).toEqual([2])
    scene.dispose()
  })

  it('setInteractive(false) disables the picker without throwing', () => {
    const problem = generateProblem(5, 'easy')
    const scene = new ProblemScene()
    const container = makeContainer()
    scene.mount(container, problem, { createRenderer: makeFakeRenderer })
    expect(() => scene.setInteractive(false)).not.toThrow()
    expect(() => scene.setInteractive(true)).not.toThrow()
    scene.dispose()
  })
})
