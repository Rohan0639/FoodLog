import { defineConfig } from 'vitest/config';

/**
 * Kept separate from vite.config.ts so the dev-only `/api` plugin does not load
 * during tests, and so the app build never type-checks the test files.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    restoreMocks: true,
  },
});
