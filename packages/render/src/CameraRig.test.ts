import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { CameraRig } from './CameraRig'

function makeCameraAndElement(): { camera: PerspectiveCamera; el: HTMLElement } {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  const el = document.createElement('div')
  return { camera, el }
}

describe('CameraRig', () => {
  it('applies distance and polar-angle clamps to the underlying controls', () => {
    const { camera, el } = makeCameraAndElement()
    const rig = new CameraRig(camera, el, { minDistance: 3, maxDistance: 6, minPolarAngle: 0.2, maxPolarAngle: 2.9 })
    expect(rig.controls.minDistance).toBe(3)
    expect(rig.controls.maxDistance).toBe(6)
    expect(rig.controls.minPolarAngle).toBe(0.2)
    expect(rig.controls.maxPolarAngle).toBe(2.9)
    rig.dispose()
  })

  it('applies documented defaults when no options are given', () => {
    const { camera, el } = makeCameraAndElement()
    const rig = new CameraRig(camera, el)
    expect(rig.controls.minDistance).toBe(2)
    expect(rig.controls.maxDistance).toBe(8)
    expect(rig.controls.enableDamping).toBe(true)
    rig.dispose()
  })

  it('setEnabled(false) disables the underlying controls (blocking input handlers)', () => {
    const { camera, el } = makeCameraAndElement()
    const rig = new CameraRig(camera, el)
    expect(rig.controls.enabled).toBe(true)
    rig.setEnabled(false)
    expect(rig.controls.enabled).toBe(false)
    rig.setEnabled(true)
    expect(rig.controls.enabled).toBe(true)
    rig.dispose()
  })

  it('update() does not throw', () => {
    const { camera, el } = makeCameraAndElement()
    const rig = new CameraRig(camera, el)
    expect(() => rig.update()).not.toThrow()
    rig.dispose()
  })
})
