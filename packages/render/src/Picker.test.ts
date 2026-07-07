import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three'
import { Picker, type PickerTarget } from './Picker'

function makeScene(): { camera: PerspectiveCamera; targets: PickerTarget[] } {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 8)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)

  const targets: PickerTarget[] = []
  const xs = [-4, -2, 0, 2, 4]
  xs.forEach((x, index) => {
    const group = new Group()
    const mesh = new Mesh(new BoxGeometry(0.8, 0.8, 0.8), new MeshBasicMaterial())
    group.add(mesh)
    group.position.set(x, 0, 0)
    group.updateMatrixWorld(true)
    targets.push({ index, object: group })
  })
  return { camera, targets }
}

function worldToNdc(position: Vector3, camera: PerspectiveCamera): { x: number; y: number } {
  const projected = position.clone().project(camera)
  return { x: projected.x, y: projected.y }
}

describe('Picker: raycast selection', () => {
  it('a ray through target 3 selects index 3', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    const worldPos = (targets[3] as PickerTarget).object.position
    const ndc = worldToNdc(worldPos, camera)
    expect(picker.pick(ndc.x, ndc.y)).toBe(3)
  })

  it('a ray through empty space selects nothing', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    expect(picker.pick(0.99, 0.99)).toBeNull()
  })

  it('pick returns null while disabled', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    picker.setInteractive(false)
    const ndc = worldToNdc((targets[0] as PickerTarget).object.position, camera)
    expect(picker.pick(ndc.x, ndc.y)).toBeNull()
  })

  it('handlePointerDown fires onSelect for the hit target', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    const selected: number[] = []
    picker.onSelect((i) => selected.push(i))
    const ndc = worldToNdc((targets[2] as PickerTarget).object.position, camera)
    picker.handlePointerDown(ndc.x, ndc.y)
    expect(selected).toEqual([2])
  })
})

describe('Picker: keyboard focus cycling', () => {
  it('focusNext cycles through all targets and wraps around', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    const seen: (number | null)[] = []
    for (let i = 0; i < 6; i++) {
      picker.focusNext()
      seen.push(picker.getFocusedIndex())
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 0])
  })

  it('focusPrev cycles backward and wraps around', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    picker.focusPrev()
    expect(picker.getFocusedIndex()).toBe(4)
  })

  it('activate() fires onSelect exactly once for the focused index', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    picker.focusNext()
    picker.focusNext() // focused = 1
    const selected: number[] = []
    picker.onSelect((i) => selected.push(i))
    picker.activate()
    expect(selected).toEqual([1])
  })

  it("disabled state swallows both pointer clicks and keyboard activation", () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    picker.focusNext()
    picker.setInteractive(false)
    const selected: number[] = []
    picker.onSelect((i) => selected.push(i))
    picker.activate()
    const ndc = worldToNdc((targets[0] as PickerTarget).object.position, camera)
    picker.handlePointerDown(ndc.x, ndc.y)
    expect(selected).toEqual([])
  })

  it('onSelect unsubscribe stops further notifications', () => {
    const { camera, targets } = makeScene()
    const picker = new Picker(targets, camera)
    const selected: number[] = []
    const unsub = picker.onSelect((i) => selected.push(i))
    picker.focusNext()
    picker.activate()
    unsub()
    picker.focusNext()
    picker.activate()
    expect(selected).toEqual([0])
  })
})
