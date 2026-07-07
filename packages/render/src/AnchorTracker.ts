import { type Camera, type Mesh, type Object3D, Raycaster, Vector3 } from 'three'

export type AnchorKey = `face:${number}` | `hinge:${number}-${number}` | `cube:${number}:face:${string}`

export interface AnchorPos {
  readonly x: number
  readonly y: number
  readonly visible: boolean
}

export interface HighlightTarget {
  readonly kind: 'face' | 'hinge' | 'cubeFace'
  readonly id: string
}

export interface HighlightStyle {
  readonly color: number
}

export type Unsubscribe = () => void

export interface AnchorTrackerOptions {
  readonly viewportSize: () => { width: number; height: number }
  readonly resolve: (key: AnchorKey) => Object3D | null
  readonly occluders?: () => readonly Object3D[]
}

const OCCLUSION_EPSILON = 0.01

export class AnchorTracker {
  private readonly subscribers = new Map<string, Set<(pos: AnchorPos) => void>>()
  private readonly raycaster = new Raycaster()
  private readonly originalColors = new Map<Object3D, number>()

  constructor(
    private readonly camera: Camera,
    private readonly options: AnchorTrackerOptions,
  ) {}

  get(key: AnchorKey): AnchorPos | null {
    const obj = this.options.resolve(key)
    if (!obj) return null

    const worldPos = new Vector3()
    obj.getWorldPosition(worldPos)
    const ndc = worldPos.clone().project(this.camera)

    const { width, height } = this.options.viewportSize()
    const x = (ndc.x * 0.5 + 0.5) * width
    const y = (-ndc.y * 0.5 + 0.5) * height

    const inFrustum = ndc.z > -1 && ndc.z < 1 && ndc.x > -1 && ndc.x < 1 && ndc.y > -1 && ndc.y < 1
    const visible = inFrustum && !this.isOccluded(worldPos)
    return { x, y, visible }
  }

  private isOccluded(worldPos: Vector3): boolean {
    const occluders = this.options.occluders?.()
    if (!occluders || occluders.length === 0) return false
    const cameraPos = new Vector3()
    this.camera.getWorldPosition(cameraPos)
    const distanceToAnchor = cameraPos.distanceTo(worldPos)
    const direction = worldPos.clone().sub(cameraPos).normalize()
    this.raycaster.set(cameraPos, direction)
    const hits = this.raycaster.intersectObjects([...occluders], true)
    return hits.some((hit) => hit.distance < distanceToAnchor - OCCLUSION_EPSILON)
  }

  subscribe(key: AnchorKey, cb: (pos: AnchorPos) => void): Unsubscribe {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set())
    this.subscribers.get(key)?.add(cb)
    return () => {
      this.subscribers.get(key)?.delete(cb)
    }
  }

  /** Call once per frame to notify all subscribers of their anchor's current position. */
  tick(): void {
    for (const [key, callbacks] of this.subscribers) {
      const pos = this.get(key as AnchorKey)
      if (!pos) continue
      for (const cb of callbacks) cb(pos)
    }
  }

  highlight(targets: readonly HighlightTarget[], style: HighlightStyle): void {
    for (const target of targets) {
      const key = highlightTargetToAnchorKey(target)
      const obj = this.options.resolve(key)
      if (!obj) continue
      this.applyHighlight(obj, style)
    }
  }

  clearHighlight(): void {
    for (const [obj, originalColor] of this.originalColors) {
      const mesh = obj as Mesh
      const material = mesh.material as { color?: { setHex: (h: number) => void } } | undefined
      material?.color?.setHex(originalColor)
    }
    this.originalColors.clear()
  }

  private applyHighlight(obj: Object3D, style: HighlightStyle): void {
    const mesh = obj as Mesh
    const material = mesh.material as { color?: { getHex: () => number; setHex: (h: number) => void } } | undefined
    if (!material?.color) return
    if (!this.originalColors.has(obj)) {
      this.originalColors.set(obj, material.color.getHex())
    }
    material.color.setHex(style.color)
  }
}

function highlightTargetToAnchorKey(target: HighlightTarget): AnchorKey {
  switch (target.kind) {
    case 'face':
      return `face:${target.id}` as AnchorKey
    case 'hinge':
      return `hinge:${target.id}` as AnchorKey
    case 'cubeFace':
      return `cube:${target.id}` as AnchorKey
  }
}
