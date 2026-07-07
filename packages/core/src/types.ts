export type FaceId = 0 | 1 | 2 | 3 | 4 | 5
export type CubeFace = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'
export const CUBE_FACES: readonly CubeFace[] = ['+x', '-x', '+y', '-y', '+z', '-z']

export type SymbolSymmetry = 'asymmetric' | '2-fold' | '4-fold'
export type Rotation = 0 | 90 | 180 | 270
export type PerturbationKind = 'opposite-swap' | 'symbol-rotation' | 'symbol-mirror' | 'adjacent-permutation'

export type SymbolTier = 'distinct' | 'mixed' | 'orientation-sensitive'
export type DistractorMixBias = 'structural' | 'balanced' | 'subtle'
export type NetBias = 'familiar' | 'uniform'
export type DifficultyPreset = 'easy' | 'medium' | 'hard'

export interface GenerationParams {
  readonly decoratedFaces: number // 3..6
  readonly symbolTier: SymbolTier
  readonly distractorMix: DistractorMixBias
  readonly netBias: NetBias
}

export interface Symbol {
  readonly glyphId: string
  readonly symmetry: SymbolSymmetry
  /**
   * Whether the glyph is drawn mirrored. Rotations never change chirality, so this bit is
   * carried through folding/rotation unchanged -- it is orthogonal to `rotation`. Ignored for
   * '4-fold' glyphs and null faces (the v1 glyph set was chosen to be achiral at that symmetry).
   */
  readonly mirrored: boolean
}

export interface NetFace {
  readonly id: FaceId
  readonly cell: readonly [number, number] // [col, row]
  readonly symbol: Symbol | null
  readonly symbolRotation: Rotation
}

export interface DecoratedNet {
  readonly netId: number
  readonly symmetryOp: number
  readonly faces: readonly NetFace[]
  readonly adjacency: readonly (readonly [FaceId, FaceId])[]
}

export interface CubeFaceState {
  readonly glyphId: string | null
  readonly symmetry: SymbolSymmetry
  readonly rotation: Rotation
  readonly mirrored: boolean
}

export interface CubeState {
  readonly faces: Readonly<Record<CubeFace, CubeFaceState>>
}

export interface Hinge {
  readonly faceId: FaceId
  readonly parentFaceId: FaceId
  readonly axis: 'x' | 'y'
  readonly pivot: readonly [number, number, number]
  readonly sign: 1 | -1
}

export interface FoldPlan {
  readonly rootFace: FaceId
  readonly hinges: readonly Hinge[]
  /** Which cube face direction each net face (by FaceId) ends up on after folding. */
  readonly faceAssignment: Readonly<Record<FaceId, CubeFace>>
}

export interface DistractorMeta {
  readonly index: number
  readonly kind: PerturbationKind
  /** Cube face directions altered by this perturbation (perturbations operate on the folded cube). */
  readonly affectedFaces: readonly CubeFace[]
}

export interface FoldProblem {
  readonly seed: number
  readonly params: GenerationParams
  readonly net: DecoratedNet
  readonly plan: FoldPlan
  readonly alternatives: readonly CubeState[]
  readonly correctIndex: number
  readonly distractorMeta: readonly DistractorMeta[]
}

export class InvalidParamsError extends Error {
  readonly reason: string
  constructor(message: string, reason: string) {
    super(message)
    this.name = 'InvalidParamsError'
    this.reason = reason
  }
}

export class GenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GenerationError'
  }
}
