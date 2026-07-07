import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DashboardScreen } from './screens/DashboardScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { PlayScreen } from './screens/PlayScreen'
import { ReviewScreen, type ReviewRequest } from './screens/ReviewScreen'
import { RoundConfigScreen } from './screens/RoundConfigScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { RoundMachine, type RoundState } from './round/roundMachine'
import { DexieSink } from './storage/DexieSink'
import { DEFAULT_PROFILE_ID, openDb, OpenFoldDB } from './storage/db'
import { InMemorySink } from './telemetry/InMemorySink'
import type { TelemetrySink } from './telemetry/TelemetrySink'
import type { SessionConfig } from './telemetry/types'

export interface AppProps {
  readonly sink?: TelemetrySink
  readonly db?: OpenFoldDB
}

interface BootResult {
  readonly sink: TelemetrySink
  readonly db: OpenFoldDB
  readonly usingFallback: boolean
}

async function boot(sinkOverride: TelemetrySink | undefined, dbOverride: OpenFoldDB | undefined): Promise<BootResult> {
  if (sinkOverride || dbOverride) {
    return { sink: sinkOverride ?? new InMemorySink(), db: dbOverride ?? new OpenFoldDB(), usingFallback: false }
  }
  try {
    const db = await openDb(new OpenFoldDB())
    return { sink: new DexieSink(db, DEFAULT_PROFILE_ID), db, usingFallback: false }
  } catch {
    return { sink: new InMemorySink(), db: new OpenFoldDB(), usingFallback: true }
  }
}

type View = 'round' | 'dashboard' | 'history'

// Stable reference so useSyncExternalStore's getSnapshot doesn't return a fresh object every call
// before the machine exists (a new object identity each render would loop useSyncExternalStore).
const BOOTING_STATE: RoundState = { phase: 'configuring' }

export function App({ sink, db }: AppProps = {}): JSX.Element {
  const bootRef = useRef<BootResult | null>(null)
  const machineRef = useRef<RoundMachine | null>(null)
  const [reconciled, setReconciled] = useState(false)
  const [showConfigOverlay, setShowConfigOverlay] = useState(false)
  const [view, setView] = useState<View>('round')
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await boot(sink, db)
      if (cancelled) return
      bootRef.current = result
      const pending = await result.sink.getPendingSession()
      if (pending) await result.sink.closeSession(pending, 'aborted', null)
      if (!cancelled) setReconciled(true)
    })()
    return () => {
      cancelled = true
    }
  }, [sink, db])

  if (reconciled && bootRef.current && !machineRef.current) {
    machineRef.current = new RoundMachine({ sink: bootRef.current.sink })
  }

  const state = useSyncExternalStore(
    (cb) => (machineRef.current ? machineRef.current.subscribe(cb) : () => {}),
    () => machineRef.current?.getState() ?? BOOTING_STATE,
  )

  if (!reconciled || !bootRef.current || !machineRef.current) return <p>Loading...</p>
  const bootResult = bootRef.current
  const machine = machineRef.current

  if (reviewRequest) {
    return <ReviewScreen request={reviewRequest} onClose={() => setReviewRequest(null)} />
  }

  return (
    <div>
      {bootResult.usingFallback && <p role="status">History disabled this session -- persistent storage is unavailable in this browser.</p>}
      <nav>
        <button type="button" onClick={() => setView('round')}>
          Play
        </button>
        {!bootResult.usingFallback && (
          <>
            <button type="button" onClick={() => setView('dashboard')}>
              Dashboard
            </button>
            <button type="button" onClick={() => setView('history')}>
              History
            </button>
          </>
        )}
      </nav>

      {view === 'dashboard' && <DashboardScreen db={bootResult.db} profileId={DEFAULT_PROFILE_ID} />}
      {view === 'history' && <HistoryScreen db={bootResult.db} profileId={DEFAULT_PROFILE_ID} onReview={setReviewRequest} />}
      {view === 'round' && renderRoundView()}
    </div>
  )

  function renderRoundView(): JSX.Element {
    if (state.phase === 'configuring' || (state.phase === 'summary' && showConfigOverlay)) {
      const onStart = (config: SessionConfig): void => {
        setShowConfigOverlay(false)
        machine.send({ type: 'START', config })
      }
      return state.phase === 'summary' ? <RoundConfigScreen initialConfig={state.config} onStart={onStart} /> : <RoundConfigScreen onStart={onStart} />
    }

    if (state.phase === 'presenting' || state.phase === 'answering' || state.phase === 'feedback') {
      return (
        <PlayScreen
          state={state}
          onSceneReady={() => machine.send({ type: 'SCENE_READY' })}
          onSelect={(index) => machine.send({ type: 'SELECT', index })}
          onNext={() => machine.send({ type: 'NEXT' })}
          onAbort={() => machine.send({ type: 'ABORT' })}
        />
      )
    }

    if (state.phase === 'summary') {
      return <SummaryScreen state={state} onRetry={(config) => machine.send({ type: 'START', config })} onNewRound={() => setShowConfigOverlay(true)} />
    }

    return (
      <div>
        <p role="alert">{state.message}</p>
        <button type="button" onClick={() => machine.send({ type: 'ACKNOWLEDGE' })}>
          Back to setup
        </button>
      </div>
    )
  }
}
