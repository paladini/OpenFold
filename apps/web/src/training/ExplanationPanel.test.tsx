import { generateProblem, generateUnfoldProblem } from '@openfold/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CompletedItem } from '../round/roundMachine'
import { ExplanationPanel } from './ExplanationPanel'

function findIncorrectFixture(): { problem: ReturnType<typeof generateProblem>; chosenIndex: number } {
  for (let seed = 0; seed < 50; seed++) {
    const problem = generateProblem(seed, 'easy')
    if (problem.distractorMeta.length > 0) {
      return { problem, chosenIndex: problem.distractorMeta[0]?.index as number }
    }
  }
  throw new Error('unreachable in test fixture')
}

function makeResult(overrides: Partial<CompletedItem> = {}): CompletedItem {
  return { itemIndex: 0, seed: 1, mode: 'fold', chosenIndex: 0, correctIndex: 0, correct: true, timedOut: false, suspect: false, responseMs: 1000, ...overrides }
}

function makeFakeScene() {
  return { highlight: vi.fn(), anchors: { clearHighlight: vi.fn() } }
}

describe('ExplanationPanel', () => {
  it('renders the headline and body for a wrong answer', () => {
    const { problem, chosenIndex } = findIncorrectFixture()
    const scene = makeFakeScene()
    render(
      <ExplanationPanel
        item={{ mode: 'fold', problem }}
        result={makeResult({ chosenIndex, correctIndex: problem.correctIndex, correct: false })}
        scene={scene as never}
      />,
    )
    expect(screen.getByText(/Opposition Rule|Orientation Rule/)).toBeInTheDocument()
  })

  it('applies the explanation highlights to the scene on mount', () => {
    const { problem, chosenIndex } = findIncorrectFixture()
    const scene = makeFakeScene()
    render(
      <ExplanationPanel
        item={{ mode: 'fold', problem }}
        result={makeResult({ chosenIndex, correctIndex: problem.correctIndex, correct: false })}
        scene={scene as never}
      />,
    )
    expect(scene.highlight).toHaveBeenCalledTimes(1)
    const [targets] = scene.highlight.mock.calls[0] as [unknown[]]
    expect(targets.length).toBeGreaterThan(0)
  })

  it('clears highlights on unmount', () => {
    const { problem, chosenIndex } = findIncorrectFixture()
    const scene = makeFakeScene()
    const { unmount } = render(
      <ExplanationPanel
        item={{ mode: 'fold', problem }}
        result={makeResult({ chosenIndex, correctIndex: problem.correctIndex, correct: false })}
        scene={scene as never}
      />,
    )
    unmount()
    expect(scene.anchors.clearHighlight).toHaveBeenCalledTimes(1)
  })

  it('renders a compact reminder for a correct answer, with no highlights', () => {
    const problem = generateProblem(1, 'medium')
    const scene = makeFakeScene()
    render(<ExplanationPanel item={{ mode: 'fold', problem }} result={makeResult({ chosenIndex: problem.correctIndex, correctIndex: problem.correctIndex, correct: true })} scene={scene as never} />)
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(scene.highlight).toHaveBeenCalledWith([], expect.anything())
  })

  it('renders the timeout variant highlighting the correct cube', () => {
    const problem = generateProblem(1, 'medium')
    const scene = makeFakeScene()
    render(<ExplanationPanel item={{ mode: 'fold', problem }} result={makeResult({ chosenIndex: null, correctIndex: problem.correctIndex, correct: false, timedOut: true })} scene={scene as never} />)
    expect(screen.getByText("Time's up")).toBeInTheDocument()
    expect(scene.highlight).toHaveBeenCalledWith([{ kind: 'cubeFace', id: `${problem.correctIndex}:face:+z` }], expect.anything())
  })

  it('renders nothing for unfold-mode items (no distractorMeta to explain against)', () => {
    const problem = generateUnfoldProblem(1, 'easy')
    const scene = makeFakeScene()
    const { container } = render(<ExplanationPanel item={{ mode: 'unfold', problem }} result={makeResult({ correct: false })} scene={scene as never} />)
    expect(container).toBeEmptyDOMElement()
    expect(scene.highlight).not.toHaveBeenCalled()
  })

  it('does not throw when the scene has not mounted yet', () => {
    const { problem, chosenIndex } = findIncorrectFixture()
    expect(() =>
      render(<ExplanationPanel item={{ mode: 'fold', problem }} result={makeResult({ chosenIndex, correctIndex: problem.correctIndex, correct: false })} scene={null} />),
    ).not.toThrow()
  })
})
