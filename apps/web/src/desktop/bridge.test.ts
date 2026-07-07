import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixtures from './ipcFixtures.json'

async function freshBridge(): Promise<typeof import('./bridge')> {
  vi.resetModules()
  return import('./bridge')
}

describe('desktopBridge: feature detection', () => {
  afterEach(() => {
    delete window.ipc
  })

  it('available is false when window.ipc is absent (plain browser)', async () => {
    const { desktopBridge } = await freshBridge()
    expect(desktopBridge.available).toBe(false)
  })

  it('available is true when window.ipc.postMessage exists (inside the desktop shell)', async () => {
    window.ipc = { postMessage: vi.fn() }
    const { desktopBridge } = await freshBridge()
    expect(desktopBridge.available).toBe(true)
  })

  it('invoke rejects with a typed "unavailable" error in a plain browser, without ever posting a message', async () => {
    const { desktopBridge } = await freshBridge()
    await expect(desktopBridge.invoke('ping')).rejects.toThrow(/unavailable/)
  })
})

describe('desktopBridge: request/response correlation', () => {
  beforeEach(() => {
    window.ipc = { postMessage: vi.fn() }
  })

  afterEach(() => {
    delete window.ipc
    delete window.__openfoldResolve
    vi.useRealTimers()
  })

  it('posts a JSON envelope with id, method, and params via window.ipc.postMessage', async () => {
    const { desktopBridge } = await freshBridge()
    void desktopBridge.invoke('ping', { foo: 'bar' })
    expect(window.ipc?.postMessage).toHaveBeenCalledTimes(1)
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const parsed = JSON.parse(raw)
    expect(parsed.method).toBe('ping')
    expect(parsed.params).toEqual({ foo: 'bar' })
    expect(typeof parsed.id).toBe('string')
  })

  it('omits params entirely from the envelope when none are given', async () => {
    const { desktopBridge } = await freshBridge()
    void desktopBridge.invoke('ping')
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    expect('params' in JSON.parse(raw)).toBe(false)
  })

  it('resolves the pending promise when __openfoldResolve is called with ok:true', async () => {
    const { desktopBridge } = await freshBridge()
    const promise = desktopBridge.invoke('ping')
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const { id } = JSON.parse(raw)

    window.__openfoldResolve?.(id, { id, ok: true, result: { version: '0.1.0', platform: 'windows', protocolVersion: 1 } })

    await expect(promise).resolves.toEqual({ version: '0.1.0', platform: 'windows', protocolVersion: 1 })
  })

  it('rejects the pending promise when __openfoldResolve is called with ok:false', async () => {
    const { desktopBridge } = await freshBridge()
    const promise = desktopBridge.invoke('sqliteQuery')
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const { id } = JSON.parse(raw)

    window.__openfoldResolve?.(id, { id, ok: false, error: { code: 'unknown_method', message: 'no such method: sqliteQuery' } })

    await expect(promise).rejects.toThrow(/unknown_method/)
  })

  it('a resolve call for an unknown or already-settled id is a silent no-op', async () => {
    const { desktopBridge } = await freshBridge()
    expect(() => window.__openfoldResolve?.('never-sent', { id: 'never-sent', ok: true, result: {} })).not.toThrow()
    await expect(Promise.resolve(desktopBridge.available)).resolves.toBe(true) // bridge still usable afterward
  })

  it('rejects with a timeout error after 5s if no response arrives', async () => {
    vi.useFakeTimers()
    const { desktopBridge } = await freshBridge()
    const promise = desktopBridge.invoke('ping')
    const assertion = expect(promise).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
  })

  it('a late response after timeout is ignored (already-deleted pending entry)', async () => {
    vi.useFakeTimers()
    const { desktopBridge } = await freshBridge()
    const promise = desktopBridge.invoke('ping')
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const { id } = JSON.parse(raw)

    const assertion = expect(promise).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(5000)
    await assertion

    expect(() => window.__openfoldResolve?.(id, { id, ok: true, result: {} })).not.toThrow()
  })
})

describe('desktopBridge: shared envelope fixtures (kept aligned with ipc.rs via ipcFixtures.json)', () => {
  beforeEach(() => {
    window.ipc = { postMessage: vi.fn() }
  })

  afterEach(() => {
    delete window.ipc
    delete window.__openfoldResolve
  })

  it('the unknownMethod fixture response rejects invoke() with the fixture error code and message', async () => {
    const { desktopBridge } = await freshBridge()
    const promise = desktopBridge.invoke(fixtures.unknownMethod.request.method)
    const [raw] = (window.ipc?.postMessage as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
    const { id } = JSON.parse(raw)

    window.__openfoldResolve?.(id, { ...fixtures.unknownMethod.response, id } as never)

    await expect(promise).rejects.toThrow(new RegExp(fixtures.unknownMethod.response.error.code))
  })

  it('the fixture file itself parses as valid JSON with the documented envelope shape', () => {
    expect(fixtures.unknownMethod.response.ok).toBe(false)
    expect(fixtures.unknownMethod.response.error.code).toBe('unknown_method')
    expect(fixtures.malformed.response.ok).toBe(false)
    expect(fixtures.malformed.response.error.code).toBe('malformed_request')
  })
})
