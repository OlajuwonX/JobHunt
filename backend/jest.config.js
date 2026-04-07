// Jest configuration for the backend
//
// Uses ts-jest to run TypeScript test files directly — no compile step needed.
// Jest reads this as plain JS so no ts-node dependency required.

/** @type {import('jest').Config} */
const config = {
  // ts-jest preset handles TypeScript compilation automatically
  preset: 'ts-jest',

  // Node environment — correct for Express (not jsdom/browser)
  testEnvironment: 'node',

  // Where to find test files
  roots: ['<rootDir>/tests'],

  // Match .test.ts and .spec.ts files
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],

  // Collect coverage from source files only
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts', // entry point — nothing to unit test here
    '!src/types/**', // type-only files
    '!src/**/*.d.ts',
  ],

  // Start at 0% — raise to 80% once real services are implemented in Phase 4
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },

  // Timeout per test (ms)
  testTimeout: 10_000,
}

module.exports = config
