import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest defaults for workspace packages.
 * @param {import('vitest/config').UserConfig} [overrides]
 */
export function createVitestConfig(overrides = {}) {
  return defineConfig({
    test: {
      globals: false,
      environment: 'node',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
      passWithNoTests: false,
      ...overrides.test,
    },
    ...overrides,
  });
}

export default createVitestConfig();
