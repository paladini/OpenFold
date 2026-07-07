import 'fake-indexeddb/auto'
import { generateNet, type DecoratedNet, type GenerationParams, type Rng } from '@openfold/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PROFILE_ID, OpenFoldDB, openDb } from '../storage/db'
import type { LessonScript } from '../training/lessonTypes'
import { TrainingHubScreen } from './TrainingHubScreen'

const PARAMS: GenerationParams = { decoratedFaces: 4, symbolTier: 'distinct', distractorMix: 'balanced', netBias: 'uniform' }

// A stable reference across renders, matching the real useProblemScene hook (it only creates a
// new scene when [containerRef, problem] change). A fresh literal per call would make
// LessonPlayer's pose effect re-fire every render forever once a practice step exists.
let fakeScene: { setProgress: ReturnType<typeof vi.fn>; setInteractive: ReturnType<typeof vi.fn>; highlight: ReturnType<typeof vi.fn>; anchors: { clearHighlight: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } }

vi.mock('../hooks/useProblemScene', () => ({
  useProblemScene: () => ({ scene: fakeScene, error: null }),
}))

beforeEach(() => {
  fakeScene = { setProgress: vi.fn(), setInteractive: vi.fn(), highlight: vi.fn(), anchors: { clearHighlight: vi.fn(), subscribe: vi.fn(() => () => {}) } }
})

function makeDummyLesson(id: string): LessonScript {
  return {
    id,
    title: `Dummy ${id}`,
    estMinutes: 2,
    makeProblem: (rng: Rng): DecoratedNet => generateNet(rng, PARAMS),
    buildSteps: () => [
      { kind: 'exposition', foldProgress: 0, highlights: [], callouts: [{ anchor: 'face:0', text: () => 'Step 0' }] },
      { kind: 'exposition', foldProgress: 1, highlights: [], callouts: [{ anchor: 'face:0', text: () => 'Step 1' }] },
    ],
  }
}

let dbCounter = 0
function nextDbName(): string {
  dbCounter += 1
  return `training-hub-test-${dbCounter}`
}

describe('TrainingHubScreen', () => {
  it('lists lessons with title and estimated duration, no badge when never started', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    expect(await screen.findByText('Dummy a -- 2 min')).toBeInTheDocument()
    expect(screen.queryByTestId('completed-badge')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('Start enters the lesson player', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    expect(await screen.findByText('Step 0')).toBeInTheDocument()
  })

  it('completing a lesson persists completion and shows the badge back on the hub', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next' })) // -> final step, completes

    expect(await screen.findByTestId('completed-badge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
  })

  it('completion persists across a simulated restart (fresh OpenFoldDB, same name)', async () => {
    const name = nextDbName()
    const first = await openDb(new OpenFoldDB(name))
    const { unmount } = render(<TrainingHubScreen db={first} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await screen.findByTestId('completed-badge')
    unmount()
    first.close()

    const second = await openDb(new OpenFoldDB(name))
    render(<TrainingHubScreen db={second} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    expect(await screen.findByTestId('completed-badge')).toBeInTheDocument()
  })

  it('Restart re-enters the lesson at step 0 even after completion', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    await screen.findByTestId('completed-badge')

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(await screen.findByText('Step 0')).toBeInTheDocument()
  })

  it('a corrupt progress row is treated as not-started rather than crashing', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    await db.settings.update(DEFAULT_PROFILE_ID, { uiPrefs: { lessons: { a: { lessonId: 'a', completed: 'yes-corrupt' } } } })
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a')]} />)
    expect(await screen.findByRole('button', { name: 'Start' })).toBeInTheDocument()
    expect(screen.queryByTestId('completed-badge')).not.toBeInTheDocument()
  })

  it('lists multiple lessons independently', async () => {
    const db = await openDb(new OpenFoldDB(nextDbName()))
    render(<TrainingHubScreen db={db} profileId={DEFAULT_PROFILE_ID} lessons={[makeDummyLesson('a'), makeDummyLesson('b')]} />)
    expect(await screen.findByText('Dummy a -- 2 min')).toBeInTheDocument()
    expect(screen.getByText('Dummy b -- 2 min')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Start' })).toHaveLength(2)
  })
})
