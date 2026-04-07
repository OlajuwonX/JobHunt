// ESLint flat config for the frontend (ESLint v9+)
// Extends Next.js recommended rules and adds Prettier integration.

import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  // Next.js core web vitals + TypeScript rules
  ...nextVitals,
  ...nextTs,

  // Prettier — disables ESLint formatting rules so Prettier owns formatting
  // Must be last
  prettier,

  {
    rules: {
      // Allow unused vars starting with _ (intentionally unused params)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Warn on explicit any during development
      '@typescript-eslint/no-explicit-any': 'warn',

      // Next.js Image component is preferred over <img>, but allow during dev
      '@next/next/no-img-element': 'warn',
    },
  },

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),
])

export default eslintConfig
