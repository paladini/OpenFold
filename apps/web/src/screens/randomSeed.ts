/** Generates a fresh session seed for a new round. Not itself deterministic -- each round is a new draw. */
export function randomSessionSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}
