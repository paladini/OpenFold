export interface ItemTimerResult {
  readonly responseMs: number
  readonly suspect: boolean
}

export interface ItemTimerOptions {
  readonly now?: () => number
  readonly setTimeout?: (cb: () => void, ms: number) => number
  readonly clearTimeout?: (handle: number) => void
}

const SUSPECT_THRESHOLD_MS = 300

/** Monotonic per-item response timer with an optional hard time limit. */
export class ItemTimer {
  private startTime: number | null = null
  private timeoutHandle: number | null = null
  private readonly now: () => number
  private readonly scheduleTimeout: (cb: () => void, ms: number) => number
  private readonly cancelTimeout: (handle: number) => void

  constructor(options: ItemTimerOptions = {}) {
    this.now = options.now ?? (() => performance.now())
    this.scheduleTimeout = options.setTimeout ?? ((cb, ms) => setTimeout(cb, ms) as unknown as number)
    this.cancelTimeout = options.clearTimeout ?? ((handle) => clearTimeout(handle))
  }

  start(limitMs: number | null, onTimeout: () => void): void {
    this.startTime = this.now()
    if (limitMs !== null) {
      this.timeoutHandle = this.scheduleTimeout(onTimeout, limitMs)
    }
  }

  /** Stops the timer (cancelling any pending timeout) and returns the elapsed-time result. */
  stop(): ItemTimerResult {
    if (this.startTime === null) throw new Error('ItemTimer.stop() called before start()')
    if (this.timeoutHandle !== null) {
      this.cancelTimeout(this.timeoutHandle)
      this.timeoutHandle = null
    }
    const responseMs = this.now() - this.startTime
    this.startTime = null
    return { responseMs, suspect: responseMs < SUSPECT_THRESHOLD_MS }
  }
}
