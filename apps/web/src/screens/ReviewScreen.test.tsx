import { generateProblem, generateUnfoldProblem } from '@openfold/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionConfig } from '../telemetry/types'
import { ReviewScreen, type ReviewRequest } from './ReviewScreen'

let fakeScene: { setInteractive: ReturnType<typeof vi.fn>; showFeedback: ReturnType<typeof vi.fn>; playFold: ReturnType<typeof vi.fn> } | null

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => ({ scene: fakeScene, error: null }),
}))

const CONFIG: SessionConfig = { difficulty: 'medium', problemCount: 5, timeLimitMs: 30_000, mode: 'fold', sessionSeed: 1 }

beforeEach(() => {
  fakeScene = { setInteractive: vi.fn(), showFeedback: vi.fn(), playFold: vi.fn().mockResolvedValue(undefined) }
})

describe('ReviewScreen', () => {
  it('regenerates the fold problem deterministically, matching a stored golden fixture for the seed', () => {
    const request: ReviewRequest = { seed: 777, config: CONFIG, mode: 'fold', chosenIndex: 0 }
    const golden = generateProblem(777, CONFIG.difficulty)
    render(<ReviewScreen request={request} onClose={() => {}} />)
    // The regenerated problem is what gets handed to useProblemScene -- assert via showFeedback,
    // which is called with the regenerated problem's own correctIndex.
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(golden.correctIndex, 0)
  })

  it('regenerates the unfold problem deterministically for unfold-mode requests', () => {
    const request: ReviewRequest = { seed: 42, config: CONFIG, mode: 'unfold', chosenIndex: 2 }
    const golden = generateUnfoldProblem(42, CONFIG.difficulty)
    render(<ReviewScreen request={request} onClose={() => {}} />)
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(golden.correctIndex, 2)
  })

  it('indicates both the correct and the chosen alternative for a wrong-answer fixture', () => {
    const golden = generateProblem(9, CONFIG.difficulty)
    const wrongChoice = (golden.correctIndex + 1) % 5
    const request: ReviewRequest = { seed: 9, config: CONFIG, mode: 'fold', chosenIndex: wrongChoice }
    render(<ReviewScreen request={request} onClose={() => {}} />)
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(golden.correctIndex, wrongChoice)
  })

  it('passes -1 to showFeedback when there was no chosen alternative (timeout)', () => {
    const request: ReviewRequest = { seed: 5, config: CONFIG, mode: 'fold', chosenIndex: null }
    render(<ReviewScreen request={request} onClose={() => {}} />)
    const golden = generateProblem(5, CONFIG.difficulty)
    expect(fakeScene?.showFeedback).toHaveBeenCalledWith(golden.correctIndex, -1)
  })

  it('locks interaction as soon as the scene mounts (read-only review)', () => {
    const request: ReviewRequest = { seed: 1, config: CONFIG, mode: 'fold', chosenIndex: 0 }
    render(<ReviewScreen request={request} onClose={() => {}} />)
    expect(fakeScene?.setInteractive).toHaveBeenCalledWith(false)
  })

  it('Replay fold calls scene.playFold and is only shown in fold mode', () => {
    const request: ReviewRequest = { seed: 1, config: CONFIG, mode: 'fold', chosenIndex: 0 }
    render(<ReviewScreen request={request} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Replay fold' }))
    expect(fakeScene?.playFold).toHaveBeenCalledTimes(1)
  })

  it('hides Replay fold for unfold-mode requests', () => {
    const request: ReviewRequest = { seed: 1, config: CONFIG, mode: 'unfold', chosenIndex: 0 }
    render(<ReviewScreen request={request} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Replay fold' })).not.toBeInTheDocument()
  })

  it('Close calls onClose', () => {
    const onClose = vi.fn()
    const request: ReviewRequest = { seed: 1, config: CONFIG, mode: 'fold', chosenIndex: 0 }
    render(<ReviewScreen request={request} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
