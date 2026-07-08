/**
 * E2E Test Problem Bank
 * 10 seeded problems for reproducible testing (difficulty tiers × problem types)
 */

export interface TestProblem {
  seed: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  description: string;
}

/**
 * Golden set of 10 problems covering all difficulty tiers.
 * Seeds are fixed to ensure deterministic, reproducible test runs.
 */
export const PROBLEM_BANK: TestProblem[] = [
  // Easy tier (3 problems)
  {
    seed: 100001,
    difficulty: 'easy',
    description: 'Easy problem #1: basic net unfolding',
  },
  {
    seed: 100002,
    difficulty: 'easy',
    description: 'Easy problem #2: simple opposite faces',
  },
  {
    seed: 100003,
    difficulty: 'easy',
    description: 'Easy problem #3: clear orientation cues',
  },

  // Medium tier (3 problems)
  {
    seed: 200001,
    difficulty: 'medium',
    description: 'Medium problem #1: moderate complexity',
  },
  {
    seed: 200002,
    difficulty: 'medium',
    description: 'Medium problem #2: requires orientation rule',
  },
  {
    seed: 200003,
    difficulty: 'medium',
    description: 'Medium problem #3: subtle adjacency',
  },

  // Hard tier (2 problems)
  {
    seed: 300001,
    difficulty: 'hard',
    description: 'Hard problem #1: complex opposition',
  },
  {
    seed: 300002,
    difficulty: 'hard',
    description: 'Hard problem #2: tricky rotation',
  },

  // Expert tier (2 problems)
  {
    seed: 400001,
    difficulty: 'expert',
    description: 'Expert problem #1: maximum ambiguity',
  },
  {
    seed: 400002,
    difficulty: 'expert',
    description: 'Expert problem #2: expert distractor similarity',
  },
];

/**
 * Get first N problems from bank, optionally filtered by difficulty.
 */
export function getTestProblems(
  count: number = 3,
  difficulty?: string
): TestProblem[] {
  let filtered = PROBLEM_BANK;
  if (difficulty) {
    filtered = PROBLEM_BANK.filter((p) => p.difficulty === difficulty);
  }
  return filtered.slice(0, count);
}

/**
 * Get a specific problem by index.
 */
export function getProblem(index: number): TestProblem | undefined {
  return PROBLEM_BANK[index];
}
