import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LessonPlayer } from './LessonPlayer'
import { lesson as oppositionRuleLesson } from './lessons/oppositionRule.lesson'
import { lesson as orientationRuleLesson } from './lessons/orientationRule.lesson'
import type { LessonScript } from './lessonTypes'

// A stable object reference across renders, like the real useProblemScene hook provides (it only
// creates a new scene when [containerRef, problem] change) -- a fresh literal on every call would
// make LessonPlayer's pose effect (keyed on `scene`) re-fire every render forever once a practice
// step's setPracticeState starts producing new objects each time.
let fakeScene: { setProgress: ReturnType<typeof vi.fn>; setInteractive: ReturnType<typeof vi.fn>; highlight: ReturnType<typeof vi.fn>; anchors: { clearHighlight: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } }

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => ({ scene: fakeScene, error: null }),
}))

beforeEach(() => {
  fakeScene = { setProgress: vi.fn(), setInteractive: vi.fn(), highlight: vi.fn(), anchors: { clearHighlight: vi.fn(), subscribe: vi.fn(() => () => {}) } }
})

/**
 * Simulates keyboard activation of the focused button: focus it (proving it's reachable without a
 * pointer), then fireEvent.click, which -- unlike a raw DOM .click() -- wraps the update in act()
 * so React's effects (including LessonPlayer's onComplete) flush before the next assertion.
 */
function activateFocused(el: HTMLElement): void {
  el.focus()
  fireEvent.click(el)
}

const LESSONS: readonly LessonScript[] = [oppositionRuleLesson, orientationRuleLesson]

describe('tutoring verification: keyboard-only + reduced-motion lesson completion', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))('%s completes via keyboard only, with reduced motion active', async (_id, lesson) => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    const onComplete = vi.fn()

    render(<LessonPlayer script={lesson} onComplete={onComplete} seed={1} />)

    for (let i = 0; i < 20 && !screen.queryByRole('group', { name: 'Practice options' }); i++) {
      activateFocused(screen.getByRole('button', { name: 'Next' }))
    }

    expect(await screen.findByRole('group', { name: 'Practice options' })).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)

    const optionButtons = screen.getByRole('group', { name: 'Practice options' }).querySelectorAll('button')
    expect(optionButtons.length).toBeGreaterThan(0)

    activateFocused(optionButtons[0] as HTMLElement)
    expect(await screen.findByRole('status')).toBeInTheDocument()

    matchMediaSpy.mockRestore()
  })
})
