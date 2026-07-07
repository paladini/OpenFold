import { describe, expect, it } from 'vitest'
import { expandPreset, resolveParams, validateParams, validateSeed } from './params'
import { InvalidParamsError } from './types'

describe('expandPreset', () => {
  it('easy: 3 decorated faces, distinct symbols, structural distractors, familiar nets', () => {
    const p = expandPreset('easy')
    expect(p).toEqual({
      decoratedFaces: 3,
      symbolTier: 'distinct',
      distractorMix: 'structural',
      netBias: 'familiar',
    })
  })

  it('medium: 5 decorated faces, mixed symbols, balanced distractors, uniform nets', () => {
    const p = expandPreset('medium')
    expect(p).toEqual({
      decoratedFaces: 5,
      symbolTier: 'mixed',
      distractorMix: 'balanced',
      netBias: 'uniform',
    })
  })

  it('hard: 6 decorated faces, orientation-sensitive symbols, subtle distractors, uniform nets', () => {
    const p = expandPreset('hard')
    expect(p).toEqual({
      decoratedFaces: 6,
      symbolTier: 'orientation-sensitive',
      distractorMix: 'subtle',
      netBias: 'uniform',
    })
  })

  it('returns frozen objects', () => {
    expect(Object.isFrozen(expandPreset('easy'))).toBe(true)
  })

  it('throws InvalidParamsError for an unknown preset name', () => {
    // @ts-expect-error testing runtime validation of an invalid literal
    expect(() => expandPreset('impossible')).toThrow(InvalidParamsError)
  })
})

describe('validateParams', () => {
  it('accepts all three presets', () => {
    expect(() => validateParams(expandPreset('easy'))).not.toThrow()
    expect(() => validateParams(expandPreset('medium'))).not.toThrow()
    expect(() => validateParams(expandPreset('hard'))).not.toThrow()
  })

  it('rejects decoratedFaces < 3', () => {
    try {
      validateParams({ decoratedFaces: 2, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidParamsError)
      expect((e as InvalidParamsError).reason).toBe('decorated_faces_out_of_range')
    }
  })

  it('rejects decoratedFaces > 6', () => {
    expect(() =>
      validateParams({ decoratedFaces: 7, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' }),
    ).toThrow(InvalidParamsError)
  })

  it('rejects non-integer decoratedFaces', () => {
    expect(() =>
      validateParams({ decoratedFaces: 3.5, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' }),
    ).toThrow(InvalidParamsError)
  })

  it('rejects an unknown symbolTier with a machine-readable reason', () => {
    try {
      validateParams({
        decoratedFaces: 4,
        // @ts-expect-error testing runtime validation
        symbolTier: 'nonsense',
        distractorMix: 'balanced',
        netBias: 'uniform',
      })
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as InvalidParamsError).reason).toBe('unknown_symbol_tier')
    }
  })
})

describe('validateSeed', () => {
  it('accepts finite numbers', () => {
    expect(() => validateSeed(0)).not.toThrow()
    expect(() => validateSeed(42)).not.toThrow()
    expect(() => validateSeed(-100)).not.toThrow()
  })

  it('rejects NaN and Infinity with a machine-readable reason', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      try {
        validateSeed(bad)
        expect.fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidParamsError)
        expect((e as InvalidParamsError).reason).toBe('invalid_seed')
      }
    }
  })
})

describe('resolveParams', () => {
  it('accepts a preset name', () => {
    expect(resolveParams('easy').decoratedFaces).toBe(3)
  })

  it('accepts and validates a custom params object', () => {
    const custom = { decoratedFaces: 4, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' } as const
    expect(resolveParams(custom)).toEqual(custom)
  })

  it('rejects an invalid custom params object', () => {
    expect(() =>
      resolveParams({ decoratedFaces: 99, symbolTier: 'mixed', distractorMix: 'balanced', netBias: 'uniform' }),
    ).toThrow(InvalidParamsError)
  })
})
