export interface MinimalDocument {
  readonly hidden: boolean
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

export interface RenderLoopOptions {
  readonly raf?: (cb: (time: number) => void) => number
  readonly caf?: (handle: number) => void
  readonly doc?: MinimalDocument
}

/**
 * Drives a tick callback via rAF, automatically suspending when the tab is hidden or the WebGL
 * context is lost, and resuming (with a caller-supplied rebuild hook) when either recovers.
 */
export class RenderLoop {
  private manuallyPaused = false
  private hiddenPaused = false
  private contextLost = false
  private rafHandle: number | null = null
  private onTick: ((time: number) => void) | null = null
  private onContextRestoredCb: (() => void) | null = null

  private readonly raf: (cb: (time: number) => void) => number
  private readonly caf: (handle: number) => void
  private readonly doc: MinimalDocument
  private readonly canvas: HTMLCanvasElement

  private readonly handleVisibility = (): void => {
    if (this.doc.hidden) {
      this.hiddenPaused = true
      this.cancelScheduled()
    } else {
      this.hiddenPaused = false
      this.scheduleIfActive()
    }
  }

  private readonly handleContextLost = (e: Event): void => {
    e.preventDefault()
    this.contextLost = true
    this.cancelScheduled()
  }

  private readonly handleContextRestored = (): void => {
    this.contextLost = false
    this.onContextRestoredCb?.()
    this.scheduleIfActive()
  }

  constructor(canvas: HTMLCanvasElement, options: RenderLoopOptions = {}) {
    this.canvas = canvas
    this.raf = options.raf ?? ((cb) => requestAnimationFrame(cb))
    this.caf = options.caf ?? ((handle) => cancelAnimationFrame(handle))
    this.doc = options.doc ?? document
    this.doc.addEventListener('visibilitychange', this.handleVisibility)
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
  }

  private get isActive(): boolean {
    return !this.manuallyPaused && !this.hiddenPaused && !this.contextLost
  }

  private cancelScheduled(): void {
    if (this.rafHandle !== null) {
      this.caf(this.rafHandle)
      this.rafHandle = null
    }
  }

  private scheduleIfActive(): void {
    if (this.rafHandle !== null || !this.isActive || !this.onTick) return
    this.rafHandle = this.raf((time) => {
      this.rafHandle = null
      this.onTick?.(time)
      this.scheduleIfActive()
    })
  }

  start(tick: (time: number) => void): void {
    this.onTick = tick
    this.scheduleIfActive()
  }

  pause(): void {
    this.manuallyPaused = true
    this.cancelScheduled()
  }

  resume(): void {
    this.manuallyPaused = false
    this.scheduleIfActive()
  }

  onContextRestored(cb: () => void): void {
    this.onContextRestoredCb = cb
  }

  dispose(): void {
    this.cancelScheduled()
    this.onTick = null
    this.doc.removeEventListener('visibilitychange', this.handleVisibility)
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
  }
}
