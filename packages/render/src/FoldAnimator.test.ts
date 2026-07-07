import { describe, expect, it } from 'vitest'
import { Group } from 'three'
import { FoldAnimator } from './FoldAnimator'
import type { HingeHandle } from './NetBuilder'

function makeHinges(count: number): HingeHandle[] {
  return Array.from({ length: count }, (_, i) => ({
    faceId: i as HingeHandle['faceId'],
    pivotGroup: new Group(),
    axis: i % 2 === 0 ? 'x' : 'y',
    sign: (i % 2 === 0 ? 1 : -1) as 1 | -1,
  }))
}

/** A deterministic fake scheduler: `raf` queues callbacks, `flush` advances the fake clock and runs them. */
function makeFakeScheduler() {
  let time = 0
  let queue: Array<(t: number) => void> = []
  let nextHandle = 1
  return {
    now: () => time,
    raf: (cb: (t: number) => void): number => {
      const handle = nextHandle++
      queue.push(cb)
      return handle
    },
    caf: (): void => {
      queue = []
    },
    advance(ms: number): void {
      time += ms
      const toRun = queue
      queue = []
      for (const cb of toRun) cb(time)
    },
  }
}

describe('FoldAnimator: setProgress', () => {
  it('setProgress(1) sets every hinge to exactly +/-90 degrees per its sign', () => {
    const hinges = makeHinges(5)
    const animator = new FoldAnimator(hinges)
    animator.setProgress(1)
    for (const hinge of hinges) {
      const expectedRad = (hinge.sign * 90 * Math.PI) / 180
      const actual = hinge.axis === 'x' ? hinge.pivotGroup.rotation.x : hinge.pivotGroup.rotation.y
      expect(actual).toBeCloseTo(expectedRad)
    }
  })

  it('setProgress(0) sets every hinge to exactly 0', () => {
    const hinges = makeHinges(5)
    const animator = new FoldAnimator(hinges)
    animator.setProgress(1)
    animator.setProgress(0)
    for (const hinge of hinges) {
      const actual = hinge.axis === 'x' ? hinge.pivotGroup.rotation.x : hinge.pivotGroup.rotation.y
      expect(actual).toBeCloseTo(0)
    }
  })

  it('clamps progress to [0,1]', () => {
    const hinges = makeHinges(2)
    const animator = new FoldAnimator(hinges)
    animator.setProgress(1.5)
    expect(animator.getProgress()).toBe(1)
    animator.setProgress(-0.5)
    expect(animator.getProgress()).toBe(0)
  })

  it("in 'stepped' mode, hinges activate one at a time across the progress range", () => {
    const hinges = makeHinges(4)
    const animator = new FoldAnimator(hinges, { mode: 'stepped' })
    animator.setProgress(0.5) // 2 of 4 windows fully elapsed
    const angle = (h: HingeHandle) => (h.axis === 'x' ? h.pivotGroup.rotation.x : h.pivotGroup.rotation.y)
    expect(Math.abs(angle(hinges[0] as HingeHandle))).toBeCloseTo(Math.PI / 2) // fully folded
    expect(Math.abs(angle(hinges[1] as HingeHandle))).toBeCloseTo(Math.PI / 2) // fully folded
    expect(Math.abs(angle(hinges[2] as HingeHandle))).toBeCloseTo(0) // not yet started
    expect(Math.abs(angle(hinges[3] as HingeHandle))).toBeCloseTo(0)
  })
})

describe('FoldAnimator: playTo with an injected scheduler', () => {
  it('tweens from start to target over the given duration and resolves exactly once', async () => {
    const hinges = makeHinges(2)
    const sched = makeFakeScheduler()
    const animator = new FoldAnimator(hinges, { now: sched.now, raf: sched.raf, caf: sched.caf })

    let resolvedCount = 0
    const promise = animator.playFold(1000).then(() => {
      resolvedCount++
    })

    sched.advance(500)
    expect(animator.getProgress()).toBeGreaterThan(0)
    expect(animator.getProgress()).toBeLessThan(1)
    expect(resolvedCount).toBe(0)

    sched.advance(500)
    await promise
    expect(animator.getProgress()).toBe(1)
    expect(resolvedCount).toBe(1)
  })

  it('playUnfold from mid-progress reverses continuously without a jump', async () => {
    const hinges = makeHinges(2)
    const sched = makeFakeScheduler()
    const animator = new FoldAnimator(hinges, { now: sched.now, raf: sched.raf, caf: sched.caf })
    animator.setProgress(0.6)

    const promise = animator.playUnfold(400)
    // Immediately after starting, progress should not have jumped away from 0.6.
    expect(animator.getProgress()).toBeCloseTo(0.6, 1)
    sched.advance(400)
    await promise
    expect(animator.getProgress()).toBe(0)
  })

  it('starting a new play cancels the previous one (only the latest resolves in the normal flow)', async () => {
    const hinges = makeHinges(2)
    const sched = makeFakeScheduler()
    const animator = new FoldAnimator(hinges, { now: sched.now, raf: sched.raf, caf: sched.caf })

    const first = animator.playFold(1000)
    sched.advance(200)
    const second = animator.playUnfold(200)
    sched.advance(200)
    await second
    expect(animator.getProgress()).toBe(0)
    // The first promise never settles once superseded -- assert it hasn't resolved by racing it
    // against an already-resolved marker.
    const race = await Promise.race([first.then(() => 'first'), Promise.resolve('marker')])
    expect(race).toBe('marker')
  })
})

describe('FoldAnimator: reduced motion', () => {
  it('playFoldReduced emits exactly 6 discrete poses (5 hinges + starting pose)', () => {
    const hinges = makeHinges(5)
    const animator = new FoldAnimator(hinges)
    const result = animator.playFoldReduced()
    expect(result.posesEmitted).toBe(6)
    expect(animator.getProgress()).toBe(1)
    expect(animator.mode).toBe('stepped')
  })
})
