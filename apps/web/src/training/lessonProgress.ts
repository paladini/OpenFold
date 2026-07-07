import type { OpenFoldDB } from '../storage/db'

export interface LessonProgressRow {
  readonly lessonId: string
  readonly completed: boolean
  readonly lastStep: number
  readonly completedAt: number | null
}

function isValidRow(value: unknown): value is LessonProgressRow {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return typeof r.lessonId === 'string' && typeof r.completed === 'boolean' && typeof r.lastStep === 'number' && (r.completedAt === null || typeof r.completedAt === 'number')
}

/** Corrupt entries are dropped (reset to not-completed) rather than surfaced -- worst case is redoing a short lesson. */
export async function getAllLessonProgress(db: OpenFoldDB, profileId: string): Promise<Record<string, LessonProgressRow>> {
  const settings = await db.settings.get(profileId)
  const raw = settings?.uiPrefs?.lessons
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, LessonProgressRow> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidRow(value)) out[key] = value
  }
  return out
}

export async function getLessonProgress(db: OpenFoldDB, profileId: string, lessonId: string): Promise<LessonProgressRow | null> {
  const all = await getAllLessonProgress(db, profileId)
  return all[lessonId] ?? null
}

export async function saveLessonProgress(db: OpenFoldDB, profileId: string, row: LessonProgressRow): Promise<void> {
  const settings = await db.settings.get(profileId)
  const uiPrefs = settings?.uiPrefs ?? {}
  const lessons = await getAllLessonProgress(db, profileId)
  await db.settings.update(profileId, { uiPrefs: { ...uiPrefs, lessons: { ...lessons, [row.lessonId]: row } } })
}
