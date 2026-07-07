import { describe, expect, it } from 'vitest'
import { RenderLoop } from './RenderLoop'

function makeFakeRaf() {
  let queue: Array<[number, (t: number) => void]> = []
  let nextHandle = 1
  const handles = new Set<number>()
  return {
    raf: (cb: (t: number) => void): number => {
      const handle = nextHandle++
      handles.add(handle)
      queue.push([handle, cb])
      return handle
    },
    caf: (handle: number): void => {
      handles.delete(handle)
      queue = queue.filter(([h]) => h !== handle)
    },
    tick(): number {
      const toRun = queue
      queue = []
      for (const [handle, cb] of toRun) {
        handles.delete(handle)
        cb(performance.now())
      }
      return toRun.length
    },
    pendingCount(): number {
      return handles.size
    },
  }
}

function makeFakeDoc(initialHidden = false) {
  let hidden = initialHidden
  const listeners = new Map<string, Set<() => void>>()
  return {
    get hidden() {
      return hidden
    },
    addEventListener: (type: string, cb: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)?.add(cb)
    },
    removeEventListener: (type: string, cb: () => void) => {
      listeners.get(type)?.delete(cb)
    },
    setHidden(value: boolean) {
      hidden = value
      for (const cb of listeners.get('visibilitychange') ?? []) cb()
    },
  }
}

describe('RenderLoop: basic scheduling', () => {
  it('start() schedules a tick, and each tick reschedules the next one', () => {
    const fakeRaf = makeFakeRaf()
    const canvas = document.createElement('canvas')
    const loop = new RenderLoop(canvas, { raf: fakeRaf.raf, caf: fakeRaf.caf })
    let ticks = 0
    loop.start(() => {
      ticks++
    })
    expect(fakeRaf.tick()).toBe(1)
    expect(ticks).toBe(1)
    expect(fakeRaf.tick()).toBe(1) // rescheduled automatically
    expect(ticks).toBe(2)
    loop.dispose()
  })

  it('pause() stops scheduling; resume() restarts it', () => {
    const fakeRaf = makeFakeRaf()
    const canvas = document.createElement('canvas')
    const loop = new RenderLoop(canvas, { raf: fakeRaf.raf, caf: fakeRaf.caf })
    let ticks = 0
    loop.start(() => ticks++)
    fakeRaf.tick()
    expect(ticks).toBe(1)

    loop.pause()
    expect(fakeRaf.pendingCount()).toBe(0)
    fakeRaf.tick() // nothing queued
    expect(ticks).toBe(1)

    loop.resume()
    fakeRaf.tick()
    expect(ticks).toBe(2)
    loop.dispose()
  })
})

describe('RenderLoop: visibility handling', () => {
  it('hidden document suspends ticking with no rAF churn; visible resumes it', () => {
    const fakeRaf = makeFakeRaf()
    const canvas = document.createElement('canvas')
    const doc = makeFakeDoc(false)
    const loop = new RenderLoop(canvas, { raf: fakeRaf.raf, caf: fakeRaf.caf, doc })
    let ticks = 0
    loop.start(() => ticks++)
    fakeRaf.tick()
    expect(ticks).toBe(1)

    doc.setHidden(true)
    expect(fakeRaf.pendingCount()).toBe(0)

    doc.setHidden(false)
    expect(fakeRaf.pendingCount()).toBe(1)
    fakeRaf.tick()
    expect(ticks).toBe(2)
    loop.dispose()
  })
})

describe('RenderLoop: WebGL context loss recovery', () => {
  it('context loss pauses and prevents default; restoration triggers the rebuild callback and resumes', () => {
    const fakeRaf = makeFakeRaf()
    const canvas = document.createElement('canvas')
    const loop = new RenderLoop(canvas, { raf: fakeRaf.raf, caf: fakeRaf.caf })
    let ticks = 0
    let rebuilt = false
    loop.onContextRestored(() => {
      rebuilt = true
    })
    loop.start(() => ticks++)
    fakeRaf.tick()
    expect(ticks).toBe(1)

    let defaultPrevented = false
    const lostEvent = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lostEvent)
    defaultPrevented = lostEvent.defaultPrevented
    expect(defaultPrevented).toBe(true)
    expect(fakeRaf.pendingCount()).toBe(0)

    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(rebuilt).toBe(true)
    expect(fakeRaf.pendingCount()).toBe(1)
    fakeRaf.tick()
    expect(ticks).toBe(2)
    loop.dispose()
  })
})

describe('RenderLoop: dispose', () => {
  it('dispose cancels pending work and stops responding to further events', () => {
    const fakeRaf = makeFakeRaf()
    const canvas = document.createElement('canvas')
    const loop = new RenderLoop(canvas, { raf: fakeRaf.raf, caf: fakeRaf.caf })
    let ticks = 0
    loop.start(() => ticks++)
    fakeRaf.tick()
    loop.dispose()
    expect(fakeRaf.pendingCount()).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    fakeRaf.tick()
    expect(ticks).toBe(1) // no further ticks after dispose
  })
})
