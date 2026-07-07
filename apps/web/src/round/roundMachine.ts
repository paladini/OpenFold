import { createRng, generateProblem, generateUnfoldProblem, type FoldProblem, type UnfoldProblem } from '@openfold/core'
import type { TelemetrySink } from '../telemetry/TelemetrySink'
import type { AttemptRecord, ItemMode, SessionConfig, SessionId, SessionSummary } from '../telemetry/types'
import { ItemTimer, type ItemTimerOptions } from './itemTimer'

export type RoundItem = { mode: 'fold'; problem: FoldProblem } | { mode: 'unfold'; problem: UnfoldProblem }

function itemCorrectIndex(item: RoundItem): number {
  return item.problem.correctIndex
}

export interface CompletedItem {
  readonly itemIndex: number
  readonly seed: number
  readonly mode: ItemMode
  readonly chosenIndex: number | null
  readonly correctIndex: number
  readonly correct: boolean
  readonly timedOut: boolean
  readonly suspect: boolean
  readonly responseMs: number
}

export type RoundState =
  | { readonly phase: 'configuring' }
  | {
      readonly phase: 'presenting'
      readonly sessionId: SessionId
      readonly config: SessionConfig
      readonly itemIndex: number
      readonly item: RoundItem
      readonly completedItems: readonly CompletedItem[]
    }
  | {
      readonly phase: 'answering'
      readonly sessionId: SessionId
      readonly config: SessionConfig
      readonly itemIndex: number
      readonly item: RoundItem
      readonly completedItems: readonly CompletedItem[]
    }
  | {
      readonly phase: 'feedback'
      readonly sessionId: SessionId
      readonly config: SessionConfig
      readonly itemIndex: number
      readonly item: RoundItem
      readonly completedItems: readonly CompletedItem[]
      readonly lastResult: CompletedItem
    }
  | {
      readonly phase: 'summary'
      readonly sessionId: SessionId
      readonly config: SessionConfig
      readonly completedItems: readonly CompletedItem[]
      readonly summary: SessionSummary
      readonly outcome: 'completed' | 'aborted'
    }
  | { readonly phase: 'failed'; readonly message: string }

export type RoundEvent =
  | { readonly type: 'START'; readonly config: SessionConfig }
  | { readonly type: 'SCENE_READY' }
  | { readonly type: 'SELECT'; readonly index: number }
  | { readonly type: 'TIMEOUT' }
  | { readonly type: 'NEXT' }
  | { readonly type: 'ABORT' }
  | { readonly type: 'SCENE_ERROR'; readonly message: string }
  | { readonly type: 'ACKNOWLEDGE' }

export type Unsubscribe = () => void

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

const MIN_PROBLEM_COUNT = 5
const MAX_PROBLEM_COUNT = 50
const MIN_TIME_LIMIT_MS = 10_000
const MAX_TIME_LIMIT_MS = 120_000

export function validateSessionConfig(config: SessionConfig): void {
  if (!Number.isInteger(config.problemCount) || config.problemCount < MIN_PROBLEM_COUNT || config.problemCount > MAX_PROBLEM_COUNT) {
    throw new ConfigValidationError(`problemCount must be an integer in [${MIN_PROBLEM_COUNT}, ${MAX_PROBLEM_COUNT}], got ${config.problemCount}`)
  }
  if (config.timeLimitMs !== null && (config.timeLimitMs < MIN_TIME_LIMIT_MS || config.timeLimitMs > MAX_TIME_LIMIT_MS)) {
    throw new ConfigValidationError(`timeLimitMs must be null or in [${MIN_TIME_LIMIT_MS}, ${MAX_TIME_LIMIT_MS}], got ${config.timeLimitMs}`)
  }
}

export function computeSummary(items: readonly CompletedItem[]): SessionSummary {
  const attempts = items.length
  const correct = items.filter((i) => i.correct).length
  const accuracy = attempts > 0 ? correct / attempts : 0
  const latencies = items
    .filter((i) => !i.suspect && !i.timedOut)
    .map((i) => i.responseMs)
    .sort((a, b) => a - b)
  const meanResponseMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
  const mid = Math.floor(latencies.length / 2)
  const medianResponseMs =
    latencies.length === 0 ? 0 : latencies.length % 2 === 1 ? (latencies[mid] as number) : ((latencies[mid - 1] as number) + (latencies[mid] as number)) / 2
  return { attempts, correct, accuracy, meanResponseMs, medianResponseMs }
}

export interface RoundMachineDeps {
  readonly sink: TelemetrySink
  readonly generateFold?: typeof generateProblem
  readonly generateUnfold?: typeof generateUnfoldProblem
  readonly now?: () => number
  readonly itemTimerOptions?: ItemTimerOptions
}

/**
 * The framework-agnostic round state machine (design.md's stateDiagram). All timing is monotonic
 * and machine-owned -- React render timing never leaks into recorded response times. Every
 * transition out of 'answering' records exactly one attempt (SELECT or TIMEOUT); ABORT from
 * 'answering' discards the in-flight item without recording it.
 */
export class RoundMachine {
  private state: RoundState = { phase: 'configuring' }
  private readonly listeners = new Set<(state: RoundState) => void>()
  private readonly itemTimer: ItemTimer
  private itemSeeds: number[] = []
  private itemModes: ItemMode[] = []
  private answeringLocked = false

  private readonly generateFold: typeof generateProblem
  private readonly generateUnfold: typeof generateUnfoldProblem
  private readonly sink: TelemetrySink
  private readonly now: () => number

  constructor(deps: RoundMachineDeps) {
    this.sink = deps.sink
    this.generateFold = deps.generateFold ?? generateProblem
    this.generateUnfold = deps.generateUnfold ?? generateUnfoldProblem
    this.now = deps.now ?? (() => Date.now())
    this.itemTimer = new ItemTimer(deps.itemTimerOptions)
  }

  getState(): RoundState {
    return this.state
  }

  subscribe(cb: (state: RoundState) => void): Unsubscribe {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  private setState(next: RoundState): void {
    this.state = next
    for (const cb of this.listeners) cb(next)
  }

  send(event: RoundEvent): void {
    switch (event.type) {
      case 'START':
        this.handleStart(event.config)
        return
      case 'SCENE_READY':
        this.handleSceneReady()
        return
      case 'SELECT':
        this.handleSelect(event.index)
        return
      case 'TIMEOUT':
        this.handleTimeout()
        return
      case 'NEXT':
        this.handleNext()
        return
      case 'ABORT':
        this.handleAbort()
        return
      case 'SCENE_ERROR':
        this.handleSceneError(event.message)
        return
      case 'ACKNOWLEDGE':
        this.handleAcknowledge()
        return
    }
  }

  private handleStart(config: SessionConfig): void {
    if (this.state.phase !== 'configuring' && this.state.phase !== 'summary' && this.state.phase !== 'failed') return
    validateSessionConfig(config)

    const rng = createRng(config.sessionSeed)
    this.itemSeeds = []
    this.itemModes = []
    for (let i = 0; i < config.problemCount; i++) {
      this.itemSeeds.push(rng.fork(`item-seed-${i}`).int(2 ** 31))
      this.itemModes.push(config.mode === 'mixed' ? (rng.fork(`item-mode-${i}`).next() < 0.5 ? 'fold' : 'unfold') : config.mode)
    }

    void this.beginSession(config)
  }

  private async beginSession(config: SessionConfig): Promise<void> {
    let sessionId: SessionId
    try {
      sessionId = await this.sink.openSession(config)
    } catch (err) {
      this.setState({ phase: 'failed', message: err instanceof Error ? err.message : 'failed to open session' })
      return
    }
    let item: RoundItem
    try {
      item = this.generateItem(0, config)
    } catch (err) {
      await this.safeClose(sessionId, 'failed', null)
      this.setState({ phase: 'failed', message: err instanceof Error ? err.message : 'failed to generate the first problem' })
      return
    }
    this.setState({ phase: 'presenting', sessionId, config, itemIndex: 0, item, completedItems: [] })
  }

  private generateItem(itemIndex: number, config: SessionConfig): RoundItem {
    const seed = this.itemSeeds[itemIndex] as number
    const mode = this.itemModes[itemIndex] as ItemMode
    if (mode === 'fold') return { mode: 'fold', problem: this.generateFold(seed, config.difficulty) }
    return { mode: 'unfold', problem: this.generateUnfold(seed, config.difficulty) }
  }

  private handleSceneReady(): void {
    if (this.state.phase !== 'presenting') return
    const s = this.state
    this.answeringLocked = false
    this.itemTimer.start(s.config.timeLimitMs, () => this.send({ type: 'TIMEOUT' }))
    this.setState({ phase: 'answering', sessionId: s.sessionId, config: s.config, itemIndex: s.itemIndex, item: s.item, completedItems: s.completedItems })
  }

  private handleSelect(index: number): void {
    if (this.state.phase !== 'answering' || this.answeringLocked) return
    this.answeringLocked = true
    const { responseMs, suspect } = this.itemTimer.stop()
    this.finishItem(index, false, responseMs, suspect)
  }

  private handleTimeout(): void {
    if (this.state.phase !== 'answering' || this.answeringLocked) return
    this.answeringLocked = true
    const { responseMs } = this.itemTimer.stop()
    this.finishItem(null, true, responseMs, false)
  }

  private finishItem(chosenIndex: number | null, timedOut: boolean, responseMs: number, suspect: boolean): void {
    if (this.state.phase !== 'answering') return
    const s = this.state
    const correctIndex = itemCorrectIndex(s.item)
    const correct = !timedOut && chosenIndex === correctIndex
    const completed: CompletedItem = {
      itemIndex: s.itemIndex,
      seed: this.itemSeeds[s.itemIndex] as number,
      mode: s.item.mode,
      chosenIndex,
      correctIndex,
      correct,
      timedOut,
      suspect,
      responseMs,
    }
    const attempt: AttemptRecord = {
      sessionId: s.sessionId,
      itemIndex: completed.itemIndex,
      seed: completed.seed,
      mode: completed.mode,
      difficulty: s.config.difficulty,
      chosenIndex: completed.chosenIndex,
      correctIndex: completed.correctIndex,
      correct: completed.correct,
      timedOut: completed.timedOut,
      suspect: completed.suspect,
      responseMs: completed.responseMs,
      answeredAt: this.now(),
    }
    void this.sink.recordAttempt(attempt)
    const completedItems = [...s.completedItems, completed]
    this.setState({
      phase: 'feedback',
      sessionId: s.sessionId,
      config: s.config,
      itemIndex: s.itemIndex,
      item: s.item,
      completedItems,
      lastResult: completed,
    })
  }

  private handleNext(): void {
    if (this.state.phase !== 'feedback') return
    const s = this.state
    const nextIndex = s.itemIndex + 1
    if (nextIndex >= s.config.problemCount) {
      const summary = computeSummary(s.completedItems)
      void this.sink.closeSession(s.sessionId, 'completed', summary)
      this.setState({ phase: 'summary', sessionId: s.sessionId, config: s.config, completedItems: s.completedItems, summary, outcome: 'completed' })
      return
    }
    let item: RoundItem
    try {
      item = this.generateItem(nextIndex, s.config)
    } catch (err) {
      void this.safeClose(s.sessionId, 'failed', null)
      this.setState({ phase: 'failed', message: err instanceof Error ? err.message : 'failed to generate the next problem' })
      return
    }
    this.setState({ phase: 'presenting', sessionId: s.sessionId, config: s.config, itemIndex: nextIndex, item, completedItems: s.completedItems })
  }

  private handleAbort(): void {
    const s = this.state
    if (s.phase !== 'presenting' && s.phase !== 'answering' && s.phase !== 'feedback') return
    if (s.phase === 'answering') {
      this.answeringLocked = true
      try {
        this.itemTimer.stop()
      } catch {
        // already stopped; nothing to cancel
      }
    }
    if (s.completedItems.length === 0) {
      void this.safeClose(s.sessionId, 'aborted', null)
      this.setState({ phase: 'configuring' })
      return
    }
    const summary = computeSummary(s.completedItems)
    void this.safeClose(s.sessionId, 'aborted', summary)
    this.setState({ phase: 'summary', sessionId: s.sessionId, config: s.config, completedItems: s.completedItems, summary, outcome: 'aborted' })
  }

  private handleSceneError(message: string): void {
    const s = this.state
    if (s.phase !== 'presenting' && s.phase !== 'answering') return
    void this.safeClose(s.sessionId, 'failed', null)
    this.setState({ phase: 'failed', message })
  }

  private handleAcknowledge(): void {
    if (this.state.phase !== 'failed') return
    this.setState({ phase: 'configuring' })
  }

  private async safeClose(sessionId: SessionId, outcome: 'completed' | 'aborted' | 'failed', summary: SessionSummary | null): Promise<void> {
    try {
      await this.sink.closeSession(sessionId, outcome, summary)
    } catch {
      // best-effort: the sink may already be in an inconsistent state (e.g. it just threw on
      // open/generate); nothing more to do from here.
    }
  }
}
