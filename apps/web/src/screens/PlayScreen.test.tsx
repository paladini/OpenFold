import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompletedItem, RoundState } from '../round/roundMachine'
import { PlayScreen } from './PlayScreen'

let fakeScene: {
  onSelect: ReturnType<typeof vi.fn>
  showFeedback: ReturnType<typeof vi.fn>
  playFold: ReturnType<typeof vi.fn>
} | null
let fakeError: Error | null
let selectCallback: ((index: number) => void) | null

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => {
    selectCallback = null
    if (fakeScene) {
      fakeScene.onSelect = vi.fn((cb: (index: number) => void) => {
        selectCallback = cb
        return () => {
          selectCallback = null
        }
      })
    }
    return { scene: fakeScene, error: fakeError }
  },
}))

const FOLD_PROBLEM = { correctIndex: 2 } as never
const UNFOLD_PROBLEM = { correctIndex: 1 } as never

function presentingState(overrides: Partial<Extract<RoundState, { phase: 'presenting' }>> = {}): Extract<RoundState, { phase: 'presenting' }> {
  return {
    phase: 'presenting',
    sessionId: 's1',
    config: { difficulty: 'medium', problemCount: 5, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 },
    itemIndex: 0,
    item: { mode: 'fold', problem: FOLD_PROBLEM },
    completedItems: [],
    ...overrides,
  }
}

function answeringState(overrides: Partial<Extract<RoundState, { phase: 'answering' }>> = {}): Extract<RoundState, { phase: 'answering' }> {
  return { ...presentingState(), phase: 'answering', ...overrides }
}

function feedbackState(result: CompletedItem, overrides: Partial<Extract<RoundState, { phase: 'feedback' }>> = {}): Extract<RoundState, { phase: 'feedback' }> {
  return { ...presentingState(), phase: 'feedback', completedItems: [result], lastResult: result, ...overrides }
}

const RESULT: CompletedItem = {
  itemIndex: 0,
  seed: 1,
  mode: 'fold',
  chosenIndex: 2,
  correctIndex: 2,
  correct: true,
  timedOut: false,
  suspect: false,
  responseMs: 1200,
}

beforeEach(() => {
  fakeScene = { onSelect: vi.fn(), showFeedback: vi.fn(), playFold: vi.fn().mockResolvedValue(undefined) }
  fakeError = null
  selectCallback = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlayScreen', () => {
  it('dispatches SCENE_READY only once the scene is mounted, while phase is presenting', () => {
    const onSceneReady = vi.fn()
    render(<PlayScreen state={presentingState()} onSceneReady={onSceneReady} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(onSceneReady).toHaveBeenCalledTimes(1)
  })

  it('does not dispatch SCENE_READY when the scene has not mounted yet', () => {
    fakeScene = null
    const onSceneReady = vi.fn()
    render(<PlayScreen state={presentingState()} onSceneReady={onSceneReady} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(onSceneReady).not.toHaveBeenCalled()
  })

  it('keys 1-5 select the corresponding option while answering', () => {
    const onSelect = vi.fn()
    render(<PlayScreen state={answeringState()} onSceneReady={() => {}} onSelect={onSelect} onNext={() => {}} onAbort={() => {}} />)
    fireEvent.keyDown(window, { key: '3' })
    expect(onSelect).toHaveBeenCalledWith(2)
  })

  it('clicking an option button selects it while answering', () => {
    const onSelect = vi.fn()
    render(<PlayScreen state={answeringState()} onSceneReady={() => {}} onSelect={onSelect} onNext={() => {}} onAbort={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '4' }))
    expect(onSelect).toHaveBeenCalledWith(3)
  })

  it('input is locked in feedback: keys 1-5 do nothing', () => {
    const onSelect = vi.fn()
    render(<PlayScreen state={feedbackState(RESULT)} onSceneReady={() => {}} onSelect={onSelect} onNext={() => {}} onAbort={() => {}} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('replay calls scene.playFold without touching onSelect/onNext (machine untouched)', () => {
    const onSelect = vi.fn()
    const onNext = vi.fn()
    render(<PlayScreen state={feedbackState(RESULT)} onSceneReady={() => {}} onSelect={onSelect} onNext={onNext} onAbort={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replay fold' }))
    expect(fakeScene?.playFold).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('hides the replay button for unfold-mode items', () => {
    const result: CompletedItem = { ...RESULT, mode: 'unfold' }
    const state = feedbackState(result, { item: { mode: 'unfold', problem: UNFOLD_PROBLEM } })
    render(<PlayScreen state={state} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Replay fold' })).not.toBeInTheDocument()
  })

  it('calls scene.showFeedback with the correct and chosen indices on entering feedback', () => {
    render(<PlayScreen state={feedbackState(RESULT)} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(2, 2)
  })

  it('passes -1 for chosenIndex to showFeedback on a timeout (no selection made)', () => {
    const timedOut: CompletedItem = { ...RESULT, chosenIndex: null, correct: false, timedOut: true }
    render(<PlayScreen state={feedbackState(timedOut)} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(2, -1)
  })

  it('invokes the feedbackSlot render prop with the item and result', () => {
    const feedbackSlot = vi.fn(() => <span>slot</span>)
    render(<PlayScreen state={feedbackState(RESULT)} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} feedbackSlot={feedbackSlot} />)
    expect(feedbackSlot).toHaveBeenCalledWith({ item: { mode: 'fold', problem: FOLD_PROBLEM }, result: RESULT })
    expect(screen.getByText('slot')).toBeInTheDocument()
  })

  it('clicking Next calls onNext', () => {
    const onNext = vi.fn()
    render(<PlayScreen state={feedbackState(RESULT)} onSceneReady={() => {}} onSelect={() => {}} onNext={onNext} onAbort={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('clicking Abort calls onAbort', () => {
    const onAbort = vi.fn()
    render(<PlayScreen state={presentingState()} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={onAbort} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abort round' }))
    expect(onAbort).toHaveBeenCalledTimes(1)
  })

  it('shows "Unlimited time" when timeLimitMs is null', () => {
    render(
      <PlayScreen
        state={answeringState({ config: { ...presentingState().config, timeLimitMs: null } })}
        onSceneReady={() => {}}
        onSelect={() => {}}
        onNext={() => {}}
        onAbort={() => {}}
      />,
    )
    expect(screen.getByText('Unlimited time')).toBeInTheDocument()
  })

  it('shows a countdown when timeLimitMs is set', () => {
    render(<PlayScreen state={answeringState()} onSceneReady={() => {}} onSelect={() => {}} onNext={() => {}} onAbort={() => {}} />)
    expect(screen.getByText(/Time left: \d+s/)).toBeInTheDocument()
  })

  it('a pointerdown selection from the scene itself (via scene.onSelect) is forwarded while answering', () => {
    const onSelect = vi.fn()
    render(<PlayScreen state={answeringState()} onSceneReady={() => {}} onSelect={onSelect} onNext={() => {}} onAbort={() => {}} />)
    selectCallback?.(4)
    expect(onSelect).toHaveBeenCalledWith(4)
  })
})
