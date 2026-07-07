// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'apps/web/demo/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // packages/core must stay deterministic: no non-seeded randomness sources.
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'packages/core must be fully deterministic — use the seeded Rng from prng.ts instead of Math.random().',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Avoid wall-clock time in deterministic domain logic; inject a clock if needed.' },
      ],
    },
  },
)
