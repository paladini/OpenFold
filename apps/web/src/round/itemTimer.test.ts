import { describe, expect, it, vi } from 'vitest'
import { ItemTimer } from './itemTimer'

function makeFakeClock() {
  let time = 0
  const timeouts: Array<{ handle: number; cb: () => void; due: number }> = []
  let nextHandle = 1
  return {
    now: () => time,
    setTimeout: (cb: () => void, ms: number) => {
      const handle = nextHandle++
      timeouts.push({ handle, cb, due: time + ms })
      return handle
    },
    clearTimeout: (handle: number) => {
      const idx = timeouts.findIndex((t) => t.handle === handle)
      if (idx >= 0) timeouts.splice(idx, 1)
    },
    advance(ms: number) {
      time += ms
      const due = timeouts.filter((t) => t.due <= time)
      for (const t of due) {
        const idx = timeouts.indexOf(t)
        if (idx >= 0) timeouts.splice(idx, 1)
        t.cb()
      }
    },
  }
}

describe('ItemTimer', () => {
  it('reports elapsed time on stop()', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    timer.start(null, () => {})
    clock.advance(1234)
    const result = timer.stop()
    expect(result.responseMs).toBe(1234)
  })

  it('fires the timeout callback exactly at the limit', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    let fired = false
    timer.start(5000, () => {
      fired = true
    })
    clock.advance(4999)
    expect(fired).toBe(false)
    clock.advance(1)
    expect(fired).toBe(true)
  })

  it('stop() before the limit cancels the pending timeout', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    let fired = false
    timer.start(5000, () => {
      fired = true
    })
    clock.advance(1000)
    timer.stop()
    clock.advance(10_000)
    expect(fired).toBe(false)
  })

  it('limitMs: null never times out', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    let fired = false
    timer.start(null, () => {
      fired = true
    })
    clock.advance(1_000_000)
    expect(fired).toBe(false)
    timer.stop()
  })

  it('flags responses under 300ms as suspect', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    timer.start(null, () => {})
    clock.advance(299)
    expect(timer.stop().suspect).toBe(true)
  })

  it('does not flag responses at or above 300ms as suspect', () => {
    const clock = makeFakeClock()
    const timer = new ItemTimer(clock)
    timer.start(null, () => {})
    clock.advance(300)
    expect(timer.stop().suspect).toBe(false)
  })

  it('throws if stop() is called before start()', () => {
    const timer = new ItemTimer()
    expect(() => timer.stop()).toThrow()
  })

  it('uses real timers by default without throwing', async () => {
    vi.useFakeTimers()
    const timer = new ItemTimer()
    let fired = false
    timer.start(10, () => {
      fired = true
    })
    vi.advanceTimersByTime(10)
    expect(fired).toBe(true)
    timer.stop()
    vi.useRealTimers()
  })
})
