import { render } from '@testing-library/react'
import { StrictMode, useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useProblemScene } from './useProblemScene'

const mountCalls: Array<{ container: HTMLElement }> = []
const disposeCalls: Array<{ id: number }> = []
let nextId = 0
let mountShouldThrow = false

vi.mock('@openfold/render', () => {
  class FakeProblemScene {
    id = nextId++
    mount(container: HTMLElement): void {
      mountCalls.push({ container })
      if (mountShouldThrow) throw new Error('mount failed')
    }
    dispose(): void {
      disposeCalls.push({ id: this.id })
    }
  }
  return { ProblemScene: FakeProblemScene }
})

function Harness({ problem }: { problem: object | null }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const { scene, error } = useProblemScene(ref, problem as never)
  return (
    <div>
      <div ref={ref} />
      <span data-testid="scene">{scene ? 'mounted' : 'null'}</span>
      <span data-testid="error">{error ? error.message : 'none'}</span>
    </div>
  )
}

describe('useProblemScene', () => {
  it('mounts a scene when a container and problem are present', () => {
    mountCalls.length = 0
    const { getByTestId } = render(<Harness problem={{ correctIndex: 0 }} />)
    expect(getByTestId('scene').textContent).toBe('mounted')
    expect(mountCalls).toHaveLength(1)
  })

  it('disposes on unmount', () => {
    disposeCalls.length = 0
    const { unmount } = render(<Harness problem={{ correctIndex: 0 }} />)
    unmount()
    expect(disposeCalls).toHaveLength(1)
  })

  it('surfaces a typed error when mount throws', () => {
    mountShouldThrow = true
    try {
      const { getByTestId } = render(<Harness problem={{ correctIndex: 0 }} />)
      expect(getByTestId('scene').textContent).toBe('null')
      expect(getByTestId('error').textContent).toBe('mount failed')
    } finally {
      mountShouldThrow = false
    }
  })

  it('does nothing when problem is null', () => {
    mountCalls.length = 0
    const { getByTestId } = render(<Harness problem={null} />)
    expect(getByTestId('scene').textContent).toBe('null')
    expect(mountCalls).toHaveLength(0)
  })

  it('strict-mode double-invoke leaves exactly one live scene', () => {
    mountCalls.length = 0
    disposeCalls.length = 0
    const { getByTestId } = render(
      <StrictMode>
        <Harness problem={{ correctIndex: 0 }} />
      </StrictMode>,
    )
    expect(getByTestId('scene').textContent).toBe('mounted')
    // Strict mode mounts, disposes, and remounts the effect once (dev-only double-invoke);
    // exactly one scene should be live at the end, with no leaked mount left un-disposed.
    expect(mountCalls.length).toBe(disposeCalls.length + 1)
  })

  it('re-mounts a fresh scene when the problem identity changes', () => {
    mountCalls.length = 0
    const problemA = { correctIndex: 0 }
    const problemB = { correctIndex: 1 }
    const { rerender, getByTestId } = render(<Harness problem={problemA} />)
    expect(mountCalls).toHaveLength(1)
    rerender(<Harness problem={problemB} />)
    expect(mountCalls).toHaveLength(2)
    expect(getByTestId('scene').textContent).toBe('mounted')
  })
})
