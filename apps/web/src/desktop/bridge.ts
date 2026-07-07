export interface IpcRequest {
  readonly id: string
  readonly method: string
  readonly params?: unknown
}

export type IpcResponse<T> = { readonly id: string; readonly ok: true; readonly result: T } | { readonly id: string; readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface PingResult {
  readonly version: string
  readonly platform: 'windows' | 'macos' | 'linux'
  readonly protocolVersion: 1
}

const TIMEOUT_MS = 5000

declare global {
  interface Window {
    ipc?: { postMessage: (message: string) => void }
    __openfoldResolve?: (id: string, response: IpcResponse<unknown>) => void
  }
}

interface PendingCall {
  readonly resolve: (value: unknown) => void
  readonly reject: (reason: Error) => void
  readonly timeoutHandle: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingCall>()
let nextId = 0

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.ipc?.postMessage === 'function'
}

/** Called by the Rust host via evaluate_script once a request is routed -- the wire from ipc.rs's route() back to a pending promise. */
function resolveCall(id: string, response: IpcResponse<unknown>): void {
  const call = pending.get(id)
  if (!call) return // already timed out, or an id we never sent -- ignore rather than throw
  pending.delete(id)
  clearTimeout(call.timeoutHandle)
  if (response.ok) call.resolve(response.result)
  else call.reject(new Error(`${response.error.code}: ${response.error.message}`))
}

if (typeof window !== 'undefined') {
  window.__openfoldResolve = resolveCall
}

function invoke<T>(method: string, params?: unknown): Promise<T> {
  if (!isAvailable()) {
    return Promise.reject(new Error('desktop bridge unavailable: not running inside the desktop shell'))
  }

  const id = `req-${nextId++}`
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`desktop bridge: '${method}' timed out after ${TIMEOUT_MS}ms`))
    }, TIMEOUT_MS)
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeoutHandle })

    const request: IpcRequest = params === undefined ? { id, method } : { id, method, params }
    window.ipc?.postMessage(JSON.stringify(request))
  })
}

/** Feature-detected bridge to the desktop shell's IPC router. `available` is false in any plain browser -- callers should branch on it rather than relying on invoke() rejecting. */
export const desktopBridge = {
  get available(): boolean {
    return isAvailable()
  },
  invoke,
}
