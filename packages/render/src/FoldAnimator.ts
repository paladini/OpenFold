import type { HingeHandle } from './NetBuilder'

export type FoldMode = 'simultaneous' | 'stepped'

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export interface FoldAnimatorOptions {
  readonly mode?: FoldMode
  readonly now?: () => number
  readonly raf?: (cb: (time: number) => void) => number
  readonly caf?: (handle: number) => void
}

/** Maps a global fold progress in [0,1] to per-hinge rotation angles, with optional tweened play. */
export class FoldAnimator {
  mode: FoldMode
  private progress = 0
  private rafHandle: number | null = null
  private readonly now: () => number
  private readonly raf: (cb: (time: number) => void) => number
  private readonly caf: (handle: number) => void

  constructor(
    private readonly hinges: readonly HingeHandle[],
    options: FoldAnimatorOptions = {},
  ) {
    this.mode = options.mode ?? 'simultaneous'
    this.now = options.now ?? (() => performance.now())
    this.raf = options.raf ?? ((cb) => requestAnimationFrame(cb))
    this.caf = options.caf ?? ((handle) => cancelAnimationFrame(handle))
    this.applyProgress()
  }

  getProgress(): number {
    return this.progress
  }

  setProgress(t: number): void {
    this.progress = Math.min(1, Math.max(0, t))
    this.applyProgress()
  }

  private applyProgress(): void {
    const n = this.hinges.length
    this.hinges.forEach((hinge, i) => {
      const hingeT = this.mode === 'stepped' ? steppedHingeProgress(this.progress, i, n) : this.progress
      const angleRad = ((hinge.sign * 90 * hingeT) * Math.PI) / 180
      if (hinge.axis === 'x') {
        hinge.pivotGroup.rotation.x = angleRad
      } else {
        hinge.pivotGroup.rotation.y = angleRad
      }
    })
  }

  private stopCurrentPlay(): void {
    if (this.rafHandle !== null) {
      this.caf(this.rafHandle)
      this.rafHandle = null
    }
  }

  playTo(target: number, durationMs = 600): Promise<void> {
    this.stopCurrentPlay()
    const clampedTarget = Math.min(1, Math.max(0, target))
    const startProgress = this.progress
    const startTime = this.now()

    return new Promise((resolve) => {
      if (durationMs <= 0 || startProgress === clampedTarget) {
        this.setProgress(clampedTarget)
        resolve()
        return
      }
      const step = (): void => {
        const elapsed = this.now() - startTime
        const t = Math.min(1, elapsed / durationMs)
        this.setProgress(startProgress + (clampedTarget - startProgress) * easeInOutCubic(t))
        if (t < 1) {
          this.rafHandle = this.raf(step)
        } else {
          this.rafHandle = null
          resolve()
        }
      }
      this.rafHandle = this.raf(step)
    })
  }

  playFold(durationMs = 600): Promise<void> {
    return this.playTo(1, durationMs)
  }

  playUnfold(durationMs = 600): Promise<void> {
    return this.playTo(0, durationMs)
  }

  /**
   * For prefers-reduced-motion: jumps through discrete poses (one per hinge, plus the starting
   * pose) instantly rather than tweening continuously. Every net has exactly 5 hinges, so this
   * always emits exactly 6 poses.
   */
  playFoldReduced(): { posesEmitted: number } {
    this.stopCurrentPlay()
    this.mode = 'stepped'
    const steps = this.hinges.length
    let posesEmitted = 0
    for (let i = 0; i <= steps; i++) {
      this.setProgress(steps === 0 ? 1 : i / steps)
      posesEmitted++
    }
    return { posesEmitted }
  }

  dispose(): void {
    this.stopCurrentPlay()
  }
}

function steppedHingeProgress(globalProgress: number, index: number, total: number): number {
  if (total === 0) return globalProgress
  const start = index / total
  const end = (index + 1) / total
  return Math.min(1, Math.max(0, (globalProgress - start) / (end - start)))
}
