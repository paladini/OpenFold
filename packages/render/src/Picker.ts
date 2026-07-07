import { Camera, type Object3D, Raycaster, Vector2 } from 'three'

export interface PickerTarget {
  readonly index: number
  readonly object: Object3D
}

export type Unsubscribe = () => void

/** Raycast pointer selection + keyboard focus cycling over a fixed set of targets (answer cubes). */
export class Picker {
  private enabled = true
  private focusedIndex: number | null = null
  private selectListeners: Array<(index: number) => void> = []
  private readonly raycaster = new Raycaster()
  private readonly objectToIndex = new Map<Object3D, number>()

  constructor(
    private readonly targets: readonly PickerTarget[],
    private readonly camera: Camera,
  ) {
    for (const t of targets) this.objectToIndex.set(t.object, t.index)
  }

  setInteractive(enabled: boolean): void {
    this.enabled = enabled
  }

  isInteractive(): boolean {
    return this.enabled
  }

  /** Returns the target index under normalized device coordinates, or null if none / disabled. */
  pick(ndcX: number, ndcY: number): number | null {
    if (!this.enabled) return null
    this.raycaster.setFromCamera(new Vector2(ndcX, ndcY), this.camera)
    const objects = this.targets.map((t) => t.object)
    const hits = this.raycaster.intersectObjects(objects, true)
    for (const hit of hits) {
      let obj: Object3D | null = hit.object
      while (obj) {
        const idx = this.objectToIndex.get(obj)
        if (idx !== undefined) return idx
        obj = obj.parent
      }
    }
    return null
  }

  handlePointerDown(ndcX: number, ndcY: number): void {
    const idx = this.pick(ndcX, ndcY)
    if (idx !== null) this.activate(idx)
  }

  focusNext(): void {
    if (!this.enabled || this.targets.length === 0) return
    const start = this.focusedIndex ?? -1
    this.focusedIndex = (start + 1) % this.targets.length
  }

  focusPrev(): void {
    if (!this.enabled || this.targets.length === 0) return
    const start = this.focusedIndex ?? 0
    this.focusedIndex = (start - 1 + this.targets.length) % this.targets.length
  }

  getFocusedIndex(): number | null {
    return this.focusedIndex
  }

  /** Activates the currently focused target (keyboard Enter), or an explicit index (pointer click). */
  activate(explicitIndex?: number): void {
    if (!this.enabled) return
    const idx = explicitIndex ?? this.focusedIndex
    if (idx === null || idx === undefined) return
    for (const cb of this.selectListeners) cb(idx)
  }

  onSelect(cb: (index: number) => void): Unsubscribe {
    this.selectListeners.push(cb)
    return () => {
      this.selectListeners = this.selectListeners.filter((l) => l !== cb)
    }
  }
}
