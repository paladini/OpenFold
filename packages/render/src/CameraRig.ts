import type { Camera } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface CameraRigOptions {
  readonly minDistance?: number
  readonly maxDistance?: number
  readonly minPolarAngle?: number
  readonly maxPolarAngle?: number
  readonly dampingFactor?: number
}

const DEFAULTS: Required<CameraRigOptions> = {
  minDistance: 2,
  maxDistance: 8,
  minPolarAngle: 0.15,
  maxPolarAngle: Math.PI - 0.15,
  dampingFactor: 0.08,
}

/** Thin wrapper around OrbitControls applying sane clamps for inspecting a small cube/net model. */
export class CameraRig {
  readonly controls: OrbitControls

  constructor(camera: Camera, domElement: HTMLElement, options: CameraRigOptions = {}) {
    const config = { ...DEFAULTS, ...options }
    this.controls = new OrbitControls(camera, domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = config.dampingFactor
    this.controls.minDistance = config.minDistance
    this.controls.maxDistance = config.maxDistance
    this.controls.minPolarAngle = config.minPolarAngle
    this.controls.maxPolarAngle = config.maxPolarAngle
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled
  }

  update(): void {
    this.controls.update()
  }

  dispose(): void {
    this.controls.dispose()
  }
}
