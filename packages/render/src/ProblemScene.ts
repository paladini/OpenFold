import type { CubeState, FoldProblem, UnfoldProblem } from '@openfold/core'
import { foldNet } from '@openfold/core'
import { Group, Mesh, MeshBasicMaterial, type Object3D, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer } from 'three'
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
  readonly reducedMotion?: boolean
  readonly maxPixelRatio?: number
  readonly createRenderer?: (canvas: HTMLCanvasElement) => MinimalRenderer
  readonly matchMedia?: (query: string) => { matches: boolean }
}

function isUnfoldProblem(problem: FoldProblem | UnfoldProblem): problem is UnfoldProblem {
  return 'questionCube' in problem
}

const OPTION_X_POSITIONS = [-4, -2, 0, 2, 4]
const OPTION_Y = -1.6
const QUESTION_Y = 1.6

function defaultCreateRenderer(canvas: HTMLCanvasElement): MinimalRenderer {
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (!gl) throw new WebGlUnsupportedError()
  return new WebGLRenderer({ canvas, antialias: true }) as unknown as MinimalRenderer
}

/** Tints every mesh in a group's subtree, remembering original colors for later restoration. */
function tintGroupSubtree(root: Object3D, color: number, originalColors: Map<Mesh, number>): void {
  root.traverse((obj) => {
    if (!(obj instanceof Mesh)) return
    const material = obj.material as MeshBasicMaterial
    if (!material?.color) return
    if (!originalColors.has(obj)) originalColors.set(obj, material.color.getHex())
    material.color.setHex(color)
  })
}

export class ProblemScene {
  private scene: Scene | null = null
  private camera: PerspectiveCamera | null = null
  private renderer: MinimalRenderer | null = null
  private renderLoop: RenderLoop | null = null
  private cameraRig: CameraRig | null = null
  private atlas: SymbolAtlas | null = null

  // Fold mode: question is an animatable net; options are static cubes.
  private questionNetRig: NetRig | null = null
  private optionCubeRigs: CubeRig[] = []
  // Unfold mode: question is a static cube; options are static (unfolded, rest-pose) nets.
  private questionCubeRig: CubeRig | null = null
  private optionNetRigs: NetRig[] = []

  private animator: FoldAnimator | null = null
  private picker: Picker | null = null
  private canvas: HTMLCanvasElement | null = null
  anchors: AnchorTracker | null = null
  private container: HTMLElement | null = null
  private problem: FoldProblem | UnfoldProblem | null = null
  private mounted = false
  private options: SceneOptions = {}
  private selectListeners: Array<(index: number) => void> = []
  private tintedColors = new Map<Mesh, number>()

  mount(container: HTMLElement, problem: FoldProblem | UnfoldProblem, opts: SceneOptions = {}): void {
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

    let optionObjects: Object3D[]
    if (isUnfoldProblem(problem)) {
      this.questionCubeRig = buildCube(problem.questionCube, this.atlas)
      this.questionCubeRig.group.position.set(0, QUESTION_Y, 0)
      this.scene.add(this.questionCubeRig.group)

      this.optionNetRigs = problem.netAlternatives.map((net, i) => {
        const { plan } = foldNet(net)
        const rig = buildNet(net, plan, this.atlas as SymbolAtlas)
        rig.root.position.x += OPTION_X_POSITIONS[i] ?? i * 2
        rig.root.position.y += OPTION_Y
        this.scene?.add(rig.root)
        return rig
      })
      optionObjects = this.optionNetRigs.map((r) => r.root)
      this.animator = null // static display in unfold mode; no fold animation to drive
    } else {
      const { plan } = foldNet(problem.net)
      this.questionNetRig = buildNet(problem.net, plan, this.atlas)
      this.questionNetRig.root.position.y += QUESTION_Y
      this.scene.add(this.questionNetRig.root)

      this.optionCubeRigs = problem.alternatives.map((cube, i) => {
        const rig = buildCube(cube, this.atlas as SymbolAtlas)
        rig.group.position.set(OPTION_X_POSITIONS[i] ?? i * 2, OPTION_Y, 0)
        this.scene?.add(rig.group)
        return rig
      })
      optionObjects = this.optionCubeRigs.map((r) => r.group)
      this.animator = new FoldAnimator(this.questionNetRig.hinges, {})
    }

    this.camera.updateMatrixWorld(true)
    this.scene.updateMatrixWorld(true)

    this.cameraRig = new CameraRig(this.camera, canvas)

    const pickerTargets: PickerTarget[] = optionObjects.map((object, index) => ({ index, object }))
    this.picker = new Picker(pickerTargets, this.camera)
    this.picker.onSelect((index) => {
      for (const cb of this.selectListeners) cb(index)
    })
    this.canvas = canvas
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)

    this.anchors = new AnchorTracker(this.camera, {
      viewportSize: () => ({ width: this.container?.clientWidth || 1, height: this.container?.clientHeight || 1 }),
      resolve: (key) => this.resolveAnchor(key),
      occluders: () => {
        const roots = [this.questionNetRig?.root, this.questionCubeRig?.group, ...optionObjects]
        return roots.filter((o): o is Group => !!o)
      },
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
    if (reducedMotion && this.animator) {
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
      const mesh = this.questionNetRig?.faceMeshes.get(faceId as never)
      return mesh ?? null
    }
    if (key.startsWith('hinge:')) {
      const [a, b] = key.slice('hinge:'.length).split('-').map(Number)
      const hinge = this.questionNetRig?.hinges.find((h) => h.faceId === b || h.faceId === a)
      return hinge?.pivotGroup ?? null
    }
    if (key.startsWith('cube:')) {
      const parts = key.slice('cube:'.length).split(':') // ["N"] or ["N", "face", "+x"]
      const idx = Number(parts[0])
      const faceSuffix = parts[2]
      const cubeRig = this.optionCubeRigs[idx]
      if (!cubeRig) return null
      if (faceSuffix) {
        return cubeRig.group.children.find((c) => c.name === `cube-face-${faceSuffix}`) ?? null
      }
      return cubeRig.group
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
    if (!this.animator) return Promise.resolve()
    if (this.options.reducedMotion ?? this.detectReducedMotion()) {
      this.animator.playFoldReduced()
      return Promise.resolve()
    }
    return this.animator.playFold()
  }

  playUnfold(): Promise<void> {
    return this.animator?.playUnfold() ?? Promise.resolve()
  }

  setInteractive(on: boolean): void {
    this.picker?.setInteractive(on)
    if (this.cameraRig) this.cameraRig.setEnabled(on)
  }

  /**
   * Highlights the correct and (if wrong) chosen alternative. Fold mode tints a specific cube
   * face via AnchorTracker (consistent with guided-training's per-face highlight API); unfold
   * mode tints the entire net option's mesh subtree directly, since a "correct/wrong" signal on a
   * whole net doesn't map to a single face the way an answer cube's does.
   */
  showFeedback(correctIndex: number, chosenIndex: number): void {
    const correctColor = 0x22c55e
    const wrongColor = 0xef4444
    if (this.optionNetRigs.length > 0) {
      const correctRig = this.optionNetRigs[correctIndex]
      if (correctRig) tintGroupSubtree(correctRig.root, correctColor, this.tintedColors)
      if (chosenIndex !== correctIndex) {
        const chosenRig = this.optionNetRigs[chosenIndex]
        if (chosenRig) tintGroupSubtree(chosenRig.root, wrongColor, this.tintedColors)
      }
      return
    }
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
   * drifted from the mathematical model. Only meaningful in fold mode (the mounted problem has an
   * animatable question net); unfold mode has no fold animation to verify this way -- its
   * correctness is entirely core's responsibility, already verified in unfold.test.ts.
   */
  computeFoldedState(): CubeState {
    if (!this.problem || !this.questionNetRig || isUnfoldProblem(this.problem)) {
      throw new Error('computeFoldedState: no fold-mode problem mounted')
    }
    this.questionNetRig.root.updateMatrixWorld(true)

    const faces: Record<string, CubeState['faces'][keyof CubeState['faces']]> = {}
    const quat = new Quaternion()
    for (const face of this.problem.net.faces) {
      const mesh = this.questionNetRig.faceMeshes.get(face.id)
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
    this.questionNetRig?.dispose()
    this.questionCubeRig?.dispose()
    for (const rig of this.optionCubeRigs) rig.dispose()
    for (const rig of this.optionNetRigs) rig.dispose()
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
    this.questionNetRig = null
    this.questionCubeRig = null
    this.optionCubeRigs = []
    this.optionNetRigs = []
    this.animator = null
    this.picker = null
    this.anchors = null
    this.container = null
    this.problem = null
    this.mounted = false
    this.selectListeners = []
    this.tintedColors = new Map()
  }
}
