import { installFakeCanvasContext } from '@openfold/render/src/testSupport/fakeCanvasContext'
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { SessionConfig } from '../telemetry/types'
import { ReviewScreen, type ReviewRequest } from './ReviewScreen'

// Deliberately does NOT mock useProblemScene -- this exercises the real hook + real ProblemScene
// mount cycle. A prior bug regenerated the problem fresh on every render (a new object identity
// each time), which made useProblemScene's mount effect re-fire forever; that class of bug is
// invisible when useProblemScene is mocked (as it is in ReviewScreen.test.tsx), since the mock
// never re-runs mount logic based on the problem prop's identity.
beforeAll(() => {
  installFakeCanvasContext()
  const proto = HTMLElement.prototype as unknown as { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void }
  proto.setPointerCapture ??= () => {}
  proto.releasePointerCapture ??= () => {}
})

const CONFIG: SessionConfig = { difficulty: 'easy', problemCount: 5, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 }

describe('ReviewScreen (real ProblemScene, not mocked)', () => {
  it('mounts exactly once -- no infinite re-mount loop from an unstable problem identity', () => {
    // jsdom has no real WebGL, so the default renderer throws WebGlUnsupportedError; that's fine
    // here -- the regression this guards against is React's "Maximum update depth exceeded" from
    // an effect that re-fires every render, which happens regardless of whether the mount itself
    // succeeds. React logs that warning via console.error, so a clean console is the real assertion.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request: ReviewRequest = { seed: 3, config: CONFIG, mode: 'fold', chosenIndex: 0 }

    const { container } = render(<ReviewScreen request={request} onClose={() => {}} />)

    expect(container.querySelectorAll('[data-testid="review-scene-container"] canvas').length).toBeLessThanOrEqual(1)
    for (const call of errorSpy.mock.calls) {
      expect(String(call[0])).not.toContain('Maximum update depth exceeded')
    }
    errorSpy.mockRestore()
  })
})
