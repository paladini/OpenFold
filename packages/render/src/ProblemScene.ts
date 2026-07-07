import type { CubeState, FoldProblem } from '@openfold/core'
import { foldNet } from '@openfold/core'
import { Group, type Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from 'three'
import { AnchorTracker, type AnchorKey, type HighlightStyle, type HighlightTarget } from './AnchorTracker'
import { CameraRig } from './CameraRig'
import { buildCube, type CubeRig } from './CubeBuilder'
import { FoldAnimator } from './FoldAnimator'
import { buildNet, type NetRig } from './NetBuilder'
import { Picker, type PickerTarget, type Unsubscribe } from './Picker'
import { upVectorToRotationDegrees, vectorToCubeFace } from './poseExtraction'
import { RenderLoop } from './RenderLoop'
import { SymbolAtlas } from './SymbolAtlas'

export class WebGlUnsupportedError extends Error {
  constructor() {
    super('ProblemScene: WebGL is not available in this environment')
    this.name = 'WebGlUnsupportedError'
  }
}

/** Minimal surface ProblemScene needs from a renderer -- lets tests inject a fake. */
export interface MinimalRenderer {
  readonly domElement: HTMLCanvasElement
  setSize(width: number, height: number, updateStyle?: boolean): void
  setPixelRatio(ratio: number): void
  render(scene: Scene, camera: PerspectiveCamera): void
  dispose(): void
  info: { memory: { geometries: number; textures: number } }
}

export interface SceneOptions {
  readonly mode?: 'fold' | 'unfold'
  readonly reducedMotion?: boolean
  readonly maxPixelRatio?: number
  readonly layout?: 'question-top' | 'question-left'
  readonly createRenderer?: (canvas: HTMLCanvasElement) => MinimalRenderer
  readonly matchMedia?: (query: string) => { matches: boolean }
}

const ANSWER_X_POSITIONS = [-4, -2, 0, 2, 4]
const ANSWER_Y = -1.6
const NET_Y = 1.6

function defaultCreateRenderer(canvas: HTMLCanvasElement): MinimalRenderer {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (!gl) throw new WebGlUnsupportedError()
  return new WebGLRenderer({ canvas, antialias: true }) as unknown as MinimalRenderer
}

export class ProblemScene {
  private scene: Scene | null = null
  private camera: PerspectiveCamera | null = null
  private renderer: MinimalRenderer | null = null
  private renderLoop: RenderLoop | null = null
  private cameraRig: CameraRig | null = null
  private atlas: SymbolAtlas | null = null
  private netRig: NetRig | null = null
  private answerRigs: CubeRig[] = []
  private animator: FoldAnimator | null = null
  private picker: Picker | null = null
  private canvas: HTMLCanvasElement | null = null
  anchors: AnchorTracker | null = null
  private container: HTMLElement | null = null
  private problem: FoldProblem | null = null
  private mounted = false
  private options: SceneOptions = {}
  private selectListeners: Array<(index: number) => void> = []

  mount(container: HTMLElement, problem: FoldProblem, opts: SceneOptions = {}): void {
    if (this.mounted) this.dispose()

    this.options = opts
    this.container = container
    this.problem = problem

    const canvas = document.createElement('canvas')
    container.innerHTML = ''
    container.appendChild(canvas)

    const createRenderer = opts.createRenderer ?? defaultCreateRenderer
    this.renderer = createRenderer(canvas)

    const width = container.clientWidth || 1
    const height = container.clientHeight || 1
    this.renderer.setPixelRatio(Math.min(opts.maxPixelRatio ?? 2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
    this.renderer.setSize(width, height)

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(45, width / height, 0.1, 100)
    this.camera.position.set(0, 0, 9)
    this.camera.lookAt(0, 0, 0)

    this.atlas = new SymbolAtlas()

    const { plan } = foldNet(problem.net)
    this.netRig = buildNet(problem.net, plan, this.atlas)
    this.netRig.root.position.y += NET_Y
    this.scene.add(this.netRig.root)

    this.answerRigs = problem.alternatives.map((cube, i) => {
      const rig = buildCube(cube, this.atlas as SymbolAtlas)
      rig.group.position.set(ANSWER_X_POSITIONS[i] ?? i * 2, ANSWER_Y, 0)
      this.scene?.add(rig.group)
      return rig
    })

    this.camera.updateMatrixWorld(true)
    this.scene.updateMatrixWorld(true)

    this.animator = new FoldAnimator(this.netRig.hinges, {})
    this.cameraRig = new CameraRig(this.camera, canvas)

    const pickerTargets: PickerTarget[] = this.answerRigs.map((rig, index) => ({ index, object: rig.group }))
    this.picker = new Picker(pickerTargets, this.camera)
    this.picker.onSelect((index) => {
      for (const cb of this.selectListeners) cb(index)
    })
    this.canvas = canvas
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)

    this.anchors = new AnchorTracker(this.camera, {
      viewportSize: () => ({ width: this.container?.clientWidth || 1, height: this.container?.clientHeight || 1 }),
      resolve: (key) => this.resolveAnchor(key),
      occluders: () => [this.netRig?.root, ...this.answerRigs.map((r) => r.group)].filter((o): o is Group => !!o),
    })

    this.renderLoop = new RenderLoop(canvas, {})
    this.renderLoop.start(() => {
      this.cameraRig?.update()
      // Ensure this frame's fold/camera updates are reflected before anchors/picking read world
      // transforms -- real WebGLRenderer.render() does this internally too, but doing it
      // explicitly means anchors are never a frame stale and picking works even before the
      // first render (e.g. a click during a test with a no-op renderer).
      this.scene?.updateMatrixWorld(true)
      this.camera?.updateMatrixWorld(true)
      this.anchors?.tick()
      if (this.scene && this.camera) this.renderer?.render(this.scene, this.camera)
    })

    const reducedMotion = opts.reducedMotion ?? this.detectReducedMotion()
    if (reducedMotion) {
      this.animator.mode = 'stepped'
    }

    this.mounted = true
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.canvas || !this.picker) return
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    this.picker.handlePointerDown(ndcX, ndcY)
  }

  private detectReducedMotion(): boolean {
    const matchMedia = this.options.matchMedia ?? (typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined)
    if (!matchMedia) return false
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }

  private resolveAnchor(key: AnchorKey): Object3D | null {
    if (key.startsWith('face:')) {
      const faceId = Number(key.slice('face:'.length))
      const mesh = this.netRig?.faceMeshes.get(faceId as never)
      return mesh ?? null
    }
    if (key.startsWith('hinge:')) {
      const [a, b] = key.slice('hinge:'.length).split('-').map(Number)
      const hinge = this.netRig?.hinges.find((h) => h.faceId === b || h.faceId === a)
      return hinge?.pivotGroup ?? null
    }
    if (key.startsWith('cube:')) {
      const rest = key.slice('cube:'.length)
      const idxStr = rest.split(':')[0]
      const idx = Number(idxStr)
      return this.answerRigs[idx]?.group ?? null
    }
    return null
  }

  resize(): void {
    if (!this.container || !this.renderer || !this.camera) return
    const width = this.container.clientWidth || 1
    const height = this.container.clientHeight || 1
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  setProgress(t: number): void {
    this.animator?.setProgress(t)
  }

  playFold(): Promise<void> {
    if (this.options.reducedMotion ?? this.detectReducedMotion()) {
      this.animator?.playFoldReduced()
      return Promise.resolve()
    }
    return this.animator?.playFold() ?? Promise.resolve()
  }

  playUnfold(): Promise<void> {
    return this.animator?.playUnfold() ?? Promise.resolve()
  }

  setInteractive(on: boolean): void {
    this.picker?.setInteractive(on)
    if (this.cameraRig) this.cameraRig.setEnabled(on)
  }

  showFeedback(correctIndex: number, chosenIndex: number): void {
    const correctColor = 0x22c55e
    const wrongColor = 0xef4444
    this.anchors?.highlight([{ kind: 'cubeFace', id: `${correctIndex}:face:+z` }], { color: correctColor })
    if (chosenIndex !== correctIndex) {
      this.anchors?.highlight([{ kind: 'cubeFace', id: `${chosenIndex}:face:+z` }], { color: wrongColor })
    }
  }

  onSelect(cb: (index: number) => void): Unsubscribe {
    this.selectListeners.push(cb)
    return () => {
      this.selectListeners = this.selectListeners.filter((l) => l !== cb)
    }
  }

  highlight(targets: readonly HighlightTarget[], style: HighlightStyle): void {
    this.anchors?.highlight(targets, style)
  }

  /**
   * The anti-divergence contract (REND-01 AC2): reconstructs a CubeState from the ACTUAL rendered
   * scene graph's world transforms (not by re-deriving from core), so a test can assert this
   * equals core's own foldNet(net).cube. Any mismatch means the render layer's fold geometry has
   * drifted from the mathematical model.
   */
  computeFoldedState(): CubeState {
    if (!this.problem || !this.netRig) throw new Error('computeFoldedState: no problem mounted')
    this.netRig.root.updateMatrixWorld(true)

    const faces: Record<string, CubeState['faces'][keyof CubeState['faces']]> = {}
    const quat = new Quaternion()
    for (const face of this.problem.net.faces) {
      const mesh = this.netRig.faceMeshes.get(face.id)
      if (!mesh) continue
      mesh.getWorldQuaternion(quat)
      const normal = new Vector3(0, 0, 1).applyQuaternion(quat)
      const up = new Vector3(0, 1, 0).applyQuaternion(quat)
      const cubeFace = vectorToCubeFace(normal)

      if (!face.symbol) {
        faces[cubeFace] = { glyphId: null, symmetry: 'asymmetric', rotation: 0, mirrored: false }
        continue
      }
      // The mesh's world "up" reflects only the FOLD-induced rotation (a property of the mesh's
      // own local frame); the authored symbolRotation was baked into its UVs separately and must
      // be added back, exactly mirroring foldMapper's (foldInduced + face.symbolRotation) % 360.
      const foldInducedRotation = upVectorToRotationDegrees(cubeFace, up)
      const rotation = ((foldInducedRotation + face.symbolRotation) % 360) as 0 | 90 | 180 | 270
      faces[cubeFace] = {
        glyphId: face.symbol.glyphId,
        symmetry: face.symbol.symmetry,
        rotation,
        mirrored: face.symbol.mirrored,
      }
    }
    return { faces } as CubeState
  }

  dispose(): void {
    this.canvas?.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderLoop?.dispose()
    this.animator?.dispose()
    this.cameraRig?.dispose()
    this.netRig?.dispose()
    for (const rig of this.answerRigs) rig.dispose()
    this.atlas?.dispose()
    this.renderer?.dispose()
    if (this.container) this.container.innerHTML = ''

    this.scene = null
    this.camera = null
    this.renderer = null
    this.renderLoop = null
    this.canvas = null
    this.cameraRig = null
    this.atlas = null
    this.netRig = null
    this.answerRigs = []
    this.animator = null
    this.picker = null
    this.anchors = null
    this.container = null
    this.problem = null
    this.mounted = false
    this.selectListeners = []
  }
}
