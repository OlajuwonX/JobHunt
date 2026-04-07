# Backend Tests

Test files mirror the `src/` directory structure:

```
src/services/auth.service.ts        → tests/services/auth.service.test.ts
src/controllers/jobs.controller.ts  → tests/controllers/jobs.controller.test.ts
src/middleware/auth.middleware.ts    → tests/middleware/auth.middleware.test.ts
```

## Running tests

```bash
npm test               # run all tests
npm run test:watch     # watch mode (re-runs on file change)
npm run test:coverage  # with coverage report
```

Tests are added in Phase 4 alongside service implementations.
