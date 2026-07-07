import { generateNet, type DecoratedNet, type GenerationParams, type Rng } from '@openfold/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonPlayer } from './LessonPlayer'
import type { LessonScript } from './lessonTypes'

const PARAMS: GenerationParams = { decoratedFaces: 4, symbolTier: 'distinct', distractorMix: 'balanced', netBias: 'uniform' }

let fakeScene: {
  setProgress: ReturnType<typeof vi.fn>
  setInteractive: ReturnType<typeof vi.fn>
  highlight: ReturnType<typeof vi.fn>
  anchors: { clearHighlight: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }
} | null

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => ({ scene: fakeScene, error: null }),
}))

beforeEach(() => {
  fakeScene = {
    setProgress: vi.fn(),
    setInteractive: vi.fn(),
    highlight: vi.fn(),
    anchors: { clearHighlight: vi.fn(), subscribe: vi.fn(() => () => {}) },
  }
})

function makeDummyScript(): LessonScript {
  return {
    id: 'dummy',
    title: 'Dummy Lesson',
    estMinutes: 1,
    makeProblem: (rng: Rng): DecoratedNet => generateNet(rng, PARAMS),
    steps: [
      { kind: 'exposition', foldProgress: 0, highlights: [{ kind: 'face', id: '0' }], callouts: [{ anchor: 'face:0', text: (net) => `Step0: face ${net.faces[0]?.id}` }] },
      { kind: 'exposition', foldProgress: 1, highlights: [{ kind: 'face', id: '1' }], callouts: [{ anchor: 'face:1', text: () => 'Step1: folded' }] },
      {
        kind: 'practice',
        prompt: () => 'Which face is opposite?',
        makeQuestion: () => ({
          prompt: 'Which face is opposite?',
          options: ['Face A', 'Face B'],
          correctIndex: 0,
          justify: () => ({ text: 'Because of the rule.', highlights: [] }),
        }),
        justification: 'oppositePairs',
      },
    ],
  }
}

describe('LessonPlayer', () => {
  it('renders the first exposition step, applying its declared pose and highlights', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    expect(fakeScene?.setProgress).toHaveBeenCalledWith(0)
    expect(fakeScene?.highlight).toHaveBeenCalledWith([{ kind: 'face', id: '0' }], expect.anything())
    expect(screen.getByText(/Step0: face/)).toBeInTheDocument()
  })

  it('Next advances to step 2 and re-applies its declared state', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(fakeScene?.setProgress).toHaveBeenCalledWith(1)
    expect(fakeScene?.highlight).toHaveBeenCalledWith([{ kind: 'face', id: '1' }], expect.anything())
    expect(screen.getByText('Step1: folded')).toBeInTheDocument()
  })

  it('Back from step 2 restores step 1 exactly (pure function of index)', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // -> step 2
    fireEvent.click(screen.getByRole('button', { name: 'Back' })) // -> step 1
    expect(fakeScene?.setProgress).toHaveBeenLastCalledWith(0)
    expect(fakeScene?.highlight).toHaveBeenLastCalledWith([{ kind: 'face', id: '0' }], expect.anything())
    expect(screen.getByText(/Step0: face/)).toBeInTheDocument()
  })

  it('Back is disabled on the first step; Next is disabled on the last step', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('practice step: answering scores and shows the justification, locking further answers', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // -> practice step

    fireEvent.click(screen.getByRole('button', { name: 'Face A' }))
    expect(screen.getByRole('status')).toHaveTextContent('Correct. Because of the rule.')
    expect(screen.getByRole('button', { name: 'Face A' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Face B' })).toBeDisabled()
  })

  it('practice step: an incorrect answer is scored as incorrect', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    fireEvent.click(screen.getByRole('button', { name: 'Face B' }))
    expect(screen.getByRole('status')).toHaveTextContent('Incorrect. Because of the rule.')
  })

  it('keyboard ArrowRight/ArrowLeft navigate steps', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={1} />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(fakeScene?.setProgress).toHaveBeenCalledWith(1)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(fakeScene?.setProgress).toHaveBeenLastCalledWith(0)
  })

  it('onComplete fires exactly once, when the final step is reached', () => {
    const onComplete = vi.fn()
    render(<LessonPlayer script={makeDummyScript()} onComplete={onComplete} seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // -> final (practice) step
    expect(onComplete).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' })) // back to final step again
    expect(onComplete).toHaveBeenCalledTimes(1) // still only once
  })

  it('resumeAt starts the player at the given step', () => {
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} resumeAt={1} seed={1} />)
    expect(screen.getByText('Step1: folded')).toBeInTheDocument()
  })

  it('the same seed produces the same net across renders (deterministic makeProblem)', () => {
    const { unmount } = render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={42} />)
    const firstText = screen.getByText(/Step0: face/).textContent
    unmount()
    render(<LessonPlayer script={makeDummyScript()} onComplete={() => {}} seed={42} />)
    expect(screen.getByText(/Step0: face/).textContent).toBe(firstText)
  })
})
