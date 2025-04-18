import { fileURLToPath } from 'node:url';

import tsConfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import esbuildConfig, { transformConfig } from '../esbuild.config.mjs';

export default defineConfig({
  plugins: [
    tsConfigPaths(),
  ],
  test: {
    setupFiles: [
      fileURLToPath(import.meta.resolve('./suppress-output.mjs')),
    ],
    clearMocks: true,
    unstubEnvs: true,
    chaiConfig: {
      includeStack: true,
      truncateThreshold: 1000,
    },
    sequence: {
      hooks: 'stack',
      setupFiles: 'list',
    },
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath.replace('/__tests__/', '/__snapshots__/') + snapExtension;
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      reportOnFailure: true,
    },
    watch: false,
  },
  resolve: {
    conditions: esbuildConfig.conditions ?? [],
    mainFields: esbuildConfig.mainFields ?? [],
  },
  esbuild: transformConfig,
});
