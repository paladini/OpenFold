import { describe, expect, it } from 'vitest'
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera } from 'three'
import { AnchorTracker, type AnchorKey, type HighlightTarget } from './AnchorTracker'

const VIEWPORT = { width: 800, height: 600 }

function makeCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, VIEWPORT.width / VIEWPORT.height, 0.1, 100)
  camera.position.set(0, 0, 8)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  return camera
}

describe('AnchorTracker: projection', () => {
  it('a known world position projects to the expected CSS pixel coordinates', () => {
    const camera = makeCamera()
    const anchor = new Object3D()
    anchor.position.set(0, 0, 0) // dead center, at the camera's look-at target
    anchor.updateMatrixWorld(true)

    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: (key) => (key === 'face:0' ? anchor : null),
    })

    const pos = tracker.get('face:0')
    expect(pos).not.toBeNull()
    // Center of the view frustum projects to the center of the viewport.
    expect(pos?.x).toBeCloseTo(VIEWPORT.width / 2, 0)
    expect(pos?.y).toBeCloseTo(VIEWPORT.height / 2, 0)
    expect(pos?.visible).toBe(true)
  })

  it('an off-center anchor projects to a correspondingly off-center pixel (left half vs right half)', () => {
    const camera = makeCamera()
    const leftAnchor = new Object3D()
    leftAnchor.position.set(-3, 0, 0)
    leftAnchor.updateMatrixWorld(true)

    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: () => leftAnchor,
    })
    const pos = tracker.get('face:0')
    expect(pos?.x).toBeLessThan(VIEWPORT.width / 2)
  })

  it('returns null for an unresolvable key, never throws', () => {
    const camera = makeCamera()
    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: () => null,
    })
    expect(() => tracker.get('face:99')).not.toThrow()
    expect(tracker.get('face:99')).toBeNull()
  })
})

describe('AnchorTracker: occlusion', () => {
  it('an anchor behind an occluder (from the camera) reports visible: false', () => {
    const camera = makeCamera() // at (0,0,8) looking at origin
    const anchor = new Object3D()
    anchor.position.set(0, 0, -2) // further from camera than the occluder below
    anchor.updateMatrixWorld(true)

    const occluder = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial())
    occluder.position.set(0, 0, 0) // sits directly between camera and anchor
    occluder.updateMatrixWorld(true)

    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: () => anchor,
      occluders: () => [occluder],
    })
    expect(tracker.get('face:0')?.visible).toBe(false)
  })

  it('an anchor with no occluder in front reports visible: true', () => {
    const camera = makeCamera()
    const anchor = new Object3D()
    anchor.position.set(0, 0, 0)
    anchor.updateMatrixWorld(true)
    const occluder = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial())
    occluder.position.set(0, 0, -5) // behind the anchor from the camera's viewpoint
    occluder.updateMatrixWorld(true)

    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: () => anchor,
      occluders: () => [occluder],
    })
    expect(tracker.get('face:0')?.visible).toBe(true)
  })
})

describe('AnchorTracker: subscription', () => {
  it('tick() notifies all subscribers with their anchor position', () => {
    const camera = makeCamera()
    const anchor = new Object3D()
    anchor.position.set(0, 0, 0)
    anchor.updateMatrixWorld(true)
    const tracker = new AnchorTracker(camera, { viewportSize: () => VIEWPORT, resolve: () => anchor })

    const received: AnchorKey[] = []
    tracker.subscribe('face:1', () => received.push('face:1'))
    tracker.subscribe('hinge:0-1', () => received.push('hinge:0-1'))
    tracker.tick()
    expect(received.sort()).toEqual(['face:1', 'hinge:0-1'])
  })

  it('unsubscribe stops further notifications', () => {
    const camera = makeCamera()
    const anchor = new Object3D()
    anchor.updateMatrixWorld(true)
    const tracker = new AnchorTracker(camera, { viewportSize: () => VIEWPORT, resolve: () => anchor })
    let count = 0
    const unsub = tracker.subscribe('face:1', () => count++)
    tracker.tick()
    unsub()
    tracker.tick()
    expect(count).toBe(1)
  })
})

describe('AnchorTracker: highlight', () => {
  it('highlight sets the material color and clearHighlight restores the original', () => {
    const camera = makeCamera()
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0x123456 }))
    const tracker = new AnchorTracker(camera, {
      viewportSize: () => VIEWPORT,
      resolve: (key) => (key === 'face:2' ? mesh : null),
    })

    const targets: HighlightTarget[] = [{ kind: 'face', id: '2' }]
    tracker.highlight(targets, { color: 0xff0000 })
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0xff0000)

    tracker.clearHighlight()
    expect((mesh.material as MeshBasicMaterial).color.getHex()).toBe(0x123456)
  })
})
