import { fileURLToPath } from 'node:url';

import tsConfigPaths from 'vite-tsconfig-paths';

import esbuildConfig, {
  transformConfig,
} from '@setup-texlive-action/config/esbuild';

/** @type {import('vitest/config').UserConfig} */
export default {
  plugins: [
    tsConfigPaths(),
  ],
  test: {
    include: [],
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
    mainFields: esbuildConfig.mainFields,
  },
  esbuild: transformConfig,
};
