import type { DifficultyPreset, GenerationParams } from './types'
import { InvalidParamsError } from './types'

const PRESETS: Readonly<Record<DifficultyPreset, GenerationParams>> = Object.freeze({
  easy: Object.freeze({
    decoratedFaces: 3,
    symbolTier: 'distinct',
    distractorMix: 'structural',
    netBias: 'familiar',
  }),
  medium: Object.freeze({
    decoratedFaces: 5,
    symbolTier: 'mixed',
    distractorMix: 'balanced',
    netBias: 'uniform',
  }),
  hard: Object.freeze({
    decoratedFaces: 6,
    symbolTier: 'orientation-sensitive',
    distractorMix: 'subtle',
    netBias: 'uniform',
  }),
})

export function expandPreset(name: DifficultyPreset): GenerationParams {
  const preset = PRESETS[name]
  if (!preset) {
    throw new InvalidParamsError(`Unknown difficulty preset: ${String(name)}`, 'unknown_preset')
  }
  return preset
}

const VALID_SYMBOL_TIERS = new Set(['distinct', 'mixed', 'orientation-sensitive'])
const VALID_DISTRACTOR_MIX = new Set(['structural', 'balanced', 'subtle'])
const VALID_NET_BIAS = new Set(['familiar', 'uniform'])

export function validateParams(params: GenerationParams): void {
  if (!Number.isInteger(params.decoratedFaces) || params.decoratedFaces < 3 || params.decoratedFaces > 6) {
    throw new InvalidParamsError(
      `decoratedFaces must be an integer in [3, 6], got ${params.decoratedFaces}`,
      'decorated_faces_out_of_range',
    )
  }
  if (!VALID_SYMBOL_TIERS.has(params.symbolTier)) {
    throw new InvalidParamsError(`Unknown symbolTier: ${String(params.symbolTier)}`, 'unknown_symbol_tier')
  }
  if (!VALID_DISTRACTOR_MIX.has(params.distractorMix)) {
    throw new InvalidParamsError(`Unknown distractorMix: ${String(params.distractorMix)}`, 'unknown_distractor_mix')
  }
  if (!VALID_NET_BIAS.has(params.netBias)) {
    throw new InvalidParamsError(`Unknown netBias: ${String(params.netBias)}`, 'unknown_net_bias')
  }
}

export function validateSeed(seed: number): void {
  if (!Number.isFinite(seed)) {
    throw new InvalidParamsError(`seed must be a finite number, got ${String(seed)}`, 'invalid_seed')
  }
}

export function resolveParams(paramsOrPreset: GenerationParams | DifficultyPreset): GenerationParams {
  const params = typeof paramsOrPreset === 'string' ? expandPreset(paramsOrPreset) : paramsOrPreset
  validateParams(params)
  return params
}
