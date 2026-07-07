import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { OpenFoldDB } from '../storage/db'
import { accuracyPerSession, difficultyProgression, latencySeries, type DifficultyProgressionPoint, type LatencyPoint, type SessionAccuracyPoint, type TimeRange } from '../storage/queries'
import type { Difficulty } from '../telemetry/types'

export interface DashboardScreenProps {
  readonly db: OpenFoldDB
  readonly profileId: string
  readonly now?: () => number
}

const RANGES: readonly TimeRange[] = ['7d', '30d', '90d', 'all']
const RANGE_LABEL: Record<TimeRange, string> = { '7d': '7d', '30d': '30d', '90d': '90d', all: 'All' }
const DIFFICULTY_TIER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }
const DIFFICULTY_COLOR: Record<Difficulty, string> = { easy: '#22c55e', medium: '#eab308', hard: '#ef4444' }

type LatencyRow = { date: string } & Partial<Record<Difficulty, number>>

function pivotLatency(points: readonly LatencyPoint[]): LatencyRow[] {
  const byDate = new Map<string, LatencyRow>()
  for (const p of points) {
    let row = byDate.get(p.date)
    if (!row) {
      row = { date: p.date }
      byDate.set(p.date, row)
    }
    row[p.difficulty] = p.meanResponseMs
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

interface DashboardData {
  readonly latency: readonly LatencyPoint[]
  readonly accuracy: readonly SessionAccuracyPoint[]
  readonly difficulty: readonly DifficultyProgressionPoint[]
}

export function DashboardScreen({ db, profileId, now = Date.now }: DashboardScreenProps): JSX.Element {
  const [range, setRange] = useState<TimeRange>('30d')
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const nowMs = now()
      const [latency, accuracy, difficulty] = await Promise.all([
        latencySeries(db, profileId, range, nowMs),
        accuracyPerSession(db, profileId, range, nowMs),
        difficultyProgression(db, profileId, range, nowMs),
      ])
      if (!cancelled) setData({ latency, accuracy, difficulty })
    })()
    return () => {
      cancelled = true
    }
  }, [db, profileId, range, now])

  if (!data) return <p>Loading...</p>

  const isEmpty = data.latency.length === 0 && data.accuracy.length === 0 && data.difficulty.length === 0
  const difficultiesPresent = Array.from(new Set(data.latency.map((p) => p.difficulty)))
  const latencyRows = pivotLatency(data.latency)
  const accuracyRows = data.accuracy.map((p, i) => ({ index: i + 1, accuracy: p.accuracy, rollingMeanAccuracy: p.rollingMeanAccuracy }))
  const difficultyRows = data.difficulty.map((p) => ({ date: p.date, tier: DIFFICULTY_TIER[p.difficulty] }))

  return (
    <div>
      <div role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r} type="button" aria-pressed={r === range} onClick={() => setRange(r)}>
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <div>
          <p>No history yet -- play a round to start tracking your progress.</p>
        </div>
      ) : (
        <>
          <section aria-label="Mean response time over time">
            <h2>Mean response time</h2>
            <LineChart width={600} height={260} data={latencyRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              {difficultiesPresent.map((d) => (
                <Line key={d} type="monotone" dataKey={d} stroke={DIFFICULTY_COLOR[d]} connectNulls />
              ))}
            </LineChart>
          </section>

          <section aria-label="Accuracy per session">
            <h2>Accuracy per session</h2>
            <ComposedChart width={600} height={260} data={accuracyRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="index" />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#3b82f6" />
              <Line type="monotone" dataKey="rollingMeanAccuracy" stroke="#f97316" dot={false} />
            </ComposedChart>
          </section>

          <section aria-label="Difficulty progression">
            <h2>Difficulty progression</h2>
            <ScatterChart width={600} height={260}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" type="category" />
              <YAxis dataKey="tier" domain={[0, 2]} ticks={[0, 1, 2]} tickFormatter={(v: number) => (['Easy', 'Medium', 'Hard'] as const)[v] ?? ''} />
              <Tooltip />
              <Scatter data={difficultyRows} fill="#8884d8" />
            </ScatterChart>
          </section>
        </>
      )}
    </div>
  )
}
