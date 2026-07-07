import type { Difficulty } from '../telemetry/types'

/** Ordinal tier order, low to high -- shared by dailyStats writes (DexieSink, rebuildDailyStats) and reads (queries' difficultyProgression). */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** A day only counts toward difficulty progression once a tier has this many attempts that day (avoids a single "touched hard once" spike). */
export const MIN_ATTEMPTS_FOR_PEAK_DIFFICULTY = 5

/** Suspect (anticipation-click) and timed-out attempts measure reaction anomalies, not spatial processing -- excluded from every latency aggregate. */
export function excludeFromLatency(attempt: { readonly suspect: boolean; readonly timedOut: boolean }): boolean {
  return attempt.suspect || attempt.timedOut
}
