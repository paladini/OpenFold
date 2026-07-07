/**
 * jsdom does not implement real 2D canvas rendering (no native `canvas` package dependency
 * here). This fake implements just the small subset of CanvasRenderingContext2D used by
 * SymbolAtlas/glyph drawing -- enough to exercise the real code path (call sequencing, UV math)
 * without producing real pixels. Tests assert structure and call behavior, not rendered output.
 */
export interface FakeCanvasContext {
  fillStyle: string
  strokeStyle: string
  readonly calls: string[]
  clearRect(x: number, y: number, w: number, h: number): void
  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  scale(x: number, y: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
  stroke(): void
}

export function installFakeCanvasContext(): void {
  const HTMLCanvasElementProto = HTMLCanvasElement.prototype as unknown as {
    getContext: (this: HTMLCanvasElement, id: string) => unknown
  }
  HTMLCanvasElementProto.getContext = function fakeGetContext(id: string) {
    if (id !== '2d') return null
    const calls: string[] = []
    const ctx: FakeCanvasContext = {
      fillStyle: '#000',
      strokeStyle: '#000',
      calls,
      clearRect: () => calls.push('clearRect'),
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      translate: () => calls.push('translate'),
      rotate: () => calls.push('rotate'),
      scale: () => calls.push('scale'),
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      closePath: () => calls.push('closePath'),
      fill: () => calls.push('fill'),
      stroke: () => calls.push('stroke'),
    }
    return ctx
  }
}
