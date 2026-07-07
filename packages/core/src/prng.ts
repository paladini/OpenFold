export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(arr: readonly T[]): T
  fork(label: string): Rng
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function step(): number {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: number): Rng {
  const rootSeed = seed >>> 0
  const next32 = mulberry32(rootSeed)

  const rng: Rng = {
    next: () => next32(),
    int: (maxExclusive: number) => {
      if (!(maxExclusive > 0)) throw new RangeError(`int() requires maxExclusive > 0, got ${maxExclusive}`)
      return Math.floor(next32() * maxExclusive)
    },
    pick: <T>(arr: readonly T[]): T => {
      if (arr.length === 0) throw new RangeError('pick() requires a non-empty array')
      const idx = rng.int(arr.length)
      // biome-ignore lint: length checked above, index is in-range by construction
      return arr[idx] as T
    },
    fork: (label: string): Rng => createRng(fnv1a(`${rootSeed}:${label}`)),
  }
  return rng
}
