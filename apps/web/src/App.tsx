import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PlayScreen } from './screens/PlayScreen'
import { RoundConfigScreen } from './screens/RoundConfigScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { InMemorySink } from './telemetry/InMemorySink'
import type { TelemetrySink } from './telemetry/TelemetrySink'
import type { SessionConfig } from './telemetry/types'
import { RoundMachine } from './round/roundMachine'

export interface AppProps {
  readonly sink?: TelemetrySink
}

export function App({ sink }: AppProps = {}): JSX.Element {
  const sinkRef = useRef<TelemetrySink | null>(null)
  sinkRef.current ??= sink ?? new InMemorySink()

  const machineRef = useRef<RoundMachine | null>(null)
  machineRef.current ??= new RoundMachine({ sink: sinkRef.current })
  const machine = machineRef.current

  const [reconciled, setReconciled] = useState(false)
  const [showConfigOverlay, setShowConfigOverlay] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const pending = await sinkRef.current?.getPendingSession()
      if (pending) await sinkRef.current?.closeSession(pending, 'aborted', null)
      if (!cancelled) setReconciled(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const state = useSyncExternalStore(
    (cb) => machine.subscribe(cb),
    () => machine.getState(),
  )

  if (!reconciled) return <p>Loading...</p>

  if (state.phase === 'configuring' || (state.phase === 'summary' && showConfigOverlay)) {
    const onStart = (config: SessionConfig): void => {
      setShowConfigOverlay(false)
      machine.send({ type: 'START', config })
    }
    return state.phase === 'summary' ? (
      <RoundConfigScreen initialConfig={state.config} onStart={onStart} />
    ) : (
      <RoundConfigScreen onStart={onStart} />
    )
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
    return (
      <SummaryScreen
        state={state}
        onRetry={(config) => machine.send({ type: 'START', config })}
        onNewRound={() => setShowConfigOverlay(true)}
      />
    )
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
