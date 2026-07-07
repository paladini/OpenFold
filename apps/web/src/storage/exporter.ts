import { rebuildDailyStats, type AttemptRow, type OpenFoldDB, type ProfileRow, type SessionRow, type SettingsRow } from './db'

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportValidationError'
  }
}

export interface ExportEnvelope {
  readonly format: 'openfold-export'
  readonly version: 1
  readonly exportedAt: number
  readonly profiles: readonly ProfileRow[]
  readonly sessions: readonly SessionRow[]
  readonly attempts: readonly AttemptRow[]
  readonly settings: readonly SettingsRow[]
}

/** Produces the full export envelope. dailyStats is never included -- it's derivable and always rebuilt on import (see design: "Import trust model"). */
export async function exportAll(db: OpenFoldDB): Promise<Blob> {
  const [profiles, sessions, attempts, settings] = await Promise.all([db.profiles.toArray(), db.sessions.toArray(), db.attempts.toArray(), db.settings.toArray()])
  const envelope: ExportEnvelope = { format: 'openfold-export', version: 1, exportedAt: Date.now(), profiles, sessions, attempts, settings }
  return new Blob([JSON.stringify(envelope)], { type: 'application/json' })
}

function validateEnvelope(data: unknown): asserts data is ExportEnvelope {
  if (typeof data !== 'object' || data === null) throw new ImportValidationError('file does not contain a valid export envelope')
  const d = data as Record<string, unknown>
  if (d.format !== 'openfold-export') throw new ImportValidationError(`unrecognized export format: ${JSON.stringify(d.format)}`)
  if (d.version !== 1) throw new ImportValidationError(`unsupported export version: ${JSON.stringify(d.version)} (this build supports version 1)`)
  for (const key of ['profiles', 'sessions', 'attempts', 'settings'] as const) {
    if (!Array.isArray(d[key])) throw new ImportValidationError(`export file is missing the required "${key}" array`)
  }
}

export interface ImportCounts {
  readonly profiles: number
  readonly sessions: number
  readonly attempts: number
  readonly settings: number
}

export interface ImportResult {
  readonly added: ImportCounts
  readonly skipped: ImportCounts
}

/** Validates the whole file before any write, merges by id (idempotent), and rebuilds dailyStats for every touched profile rather than trusting any aggregate in the file (there is none: dailyStats is never exported). */
export async function importFile(db: OpenFoldDB, file: Blob): Promise<ImportResult> {
  const text = await file.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportValidationError('file is not valid JSON')
  }
  validateEnvelope(data)

  const added = { profiles: 0, sessions: 0, attempts: 0, settings: 0 }
  const skipped = { profiles: 0, sessions: 0, attempts: 0, settings: 0 }
  const touchedProfileIds = new Set<string>()

  await db.transaction('rw', db.profiles, db.sessions, db.attempts, db.settings, async () => {
    for (const p of data.profiles) {
      if (await db.profiles.get(p.id)) skipped.profiles += 1
      else {
        await db.profiles.add(p)
        added.profiles += 1
      }
      touchedProfileIds.add(p.id)
    }
    for (const s of data.sessions) {
      if (await db.sessions.get(s.id)) skipped.sessions += 1
      else {
        await db.sessions.add(s)
        added.sessions += 1
      }
      touchedProfileIds.add(s.profileId)
    }
    for (const a of data.attempts) {
      if (await db.attempts.get(a.id)) skipped.attempts += 1
      else {
        await db.attempts.add(a)
        added.attempts += 1
      }
    }
    for (const st of data.settings) {
      if (await db.settings.get(st.profileId)) skipped.settings += 1
      else {
        await db.settings.add(st)
        added.settings += 1
      }
    }
  })

  for (const profileId of touchedProfileIds) await rebuildDailyStats(db, profileId)

  return { added, skipped }
}
