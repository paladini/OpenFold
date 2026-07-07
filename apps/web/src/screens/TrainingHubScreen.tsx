import { useEffect, useState } from 'react'
import type { OpenFoldDB } from '../storage/db'
import { LessonPlayer } from '../training/LessonPlayer'
import { getAllLessonProgress, saveLessonProgress, type LessonProgressRow } from '../training/lessonProgress'
import { LESSONS } from '../training/lessons'
import type { LessonScript } from '../training/lessonTypes'

export interface TrainingHubScreenProps {
  readonly db: OpenFoldDB
  readonly profileId: string
  readonly lessons?: readonly LessonScript[]
}

interface PlayingState {
  readonly script: LessonScript
  readonly resumeAt: number
}

export function TrainingHubScreen({ db, profileId, lessons = LESSONS }: TrainingHubScreenProps): JSX.Element {
  const [progress, setProgress] = useState<Record<string, LessonProgressRow> | null>(null)
  const [playing, setPlaying] = useState<PlayingState | null>(null)

  useEffect(() => {
    let cancelled = false
    void getAllLessonProgress(db, profileId).then((p) => {
      if (!cancelled) setProgress(p)
    })
    return () => {
      cancelled = true
    }
  }, [db, profileId])

  async function handleComplete(script: LessonScript, finalStepIndex: number): Promise<void> {
    const row: LessonProgressRow = { lessonId: script.id, completed: true, lastStep: finalStepIndex, completedAt: Date.now() }
    await saveLessonProgress(db, profileId, row)
    setProgress(await getAllLessonProgress(db, profileId))
    setPlaying(null)
  }

  if (playing) {
    return (
      <LessonPlayer
        script={playing.script}
        resumeAt={playing.resumeAt}
        onComplete={(finalStepIndex) => void handleComplete(playing.script, finalStepIndex)}
      />
    )
  }

  if (!progress) return <p>Loading...</p>

  return (
    <div>
      <h2>Training</h2>
      <ul aria-label="Lessons">
        {lessons.map((lesson) => {
          const row = progress[lesson.id]
          return (
            <li key={lesson.id}>
              <span>
                {lesson.title} -- {lesson.estMinutes} min
              </span>
              {row?.completed && <span data-testid="completed-badge"> (Completed)</span>}
              {row ? (
                <>
                  <button type="button" onClick={() => setPlaying({ script: lesson, resumeAt: row.lastStep })}>
                    Resume
                  </button>
                  <button type="button" onClick={() => setPlaying({ script: lesson, resumeAt: 0 })}>
                    Restart
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setPlaying({ script: lesson, resumeAt: 0 })}>
                  Start
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
