// ESLint flat config for the backend (ESLint v9+)
// This replaces the old .eslintrc.* format entirely.
//
// Rule of thumb used here:
//   - typescript-eslint/recommended: catches real bugs (unused vars, unsafe any, etc.)
//   - eslint-config-prettier: turns OFF any ESLint formatting rules — Prettier owns formatting
//   - Our overrides: relax a few rules that are too noisy during active development

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // Base JS rules (no-undef, no-unused-vars, etc.)
  js.configs.recommended,

  // TypeScript-aware rules — extends the base JS rules with TS knowledge
  ...tseslint.configs.recommended,

  // Prettier integration — disables all ESLint rules that would conflict with Prettier's formatting
  // Must be LAST so it can turn off anything above it
  prettier,

  {
    // Which files this config applies to
    files: ['src/**/*.ts'],

    rules: {
      // ─── Overrides for active development ─────────────────────────────────

      // Allow unused identifiers that start with _ — covers both:
      //   - function arguments:  async (_req, res) => {}
      //   - local variables:     const _userId = req.user!.id  (stub placeholder)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Allow explicit `any` with a warning instead of an error during early dev
      // Change to 'error' when the codebase matures
      '@typescript-eslint/no-explicit-any': 'warn',

      // Allow empty async functions — useful for stub controllers before services are built
      '@typescript-eslint/no-empty-function': 'warn',

      // Allow `declare global { namespace Express {} }` — standard TS pattern for augmenting
      // third-party types (e.g. adding req.user to Express.Request)
      '@typescript-eslint/no-namespace': 'off',

      // Allow `var` inside `declare global {}` blocks — TypeScript requires `var` there
      'no-var': 'off',

      // Require explicit return types on exported functions (helps catch bugs early)
      '@typescript-eslint/explicit-function-return-type': 'off', // off — too verbose for now

      // Require explicit module boundary types (exported function params/returns)
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  {
    // Files and directories to completely ignore
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js'],
  }
)
