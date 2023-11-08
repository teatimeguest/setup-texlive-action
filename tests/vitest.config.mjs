import { env } from 'node:process';

import tsconfigPaths from 'vite-tsconfig-paths';

import esbuildConfig, { transformOptions } from '##/.config/esbuild.config.mjs';

const root = env['npm_config_local_prefix'];

/** @type import('vitest/config').UserConfig */
export default {
  plugins: [
    tsconfigPaths(),
  ],
  test: {
    root,
    include: [
      'tests/__tests__/**/*.test.ts',
    ],
    setupFiles: [
      'tests/vitest/suppress-output.ts',
      'tests/vitest/setup-jest-extended.ts',
      'tests/vitest/setup-globals.ts',
      'tests/vitest/setup-mocks.ts',
    ],
    globals: true,
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
      return testPath.replace('__tests__', '__snapshots__') + snapExtension;
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        '**/*.d.ts',
        'src/globals.ts',
        'src/index.ts',
        'src/polyfill/**/*',
      ],
      reporter: ['text', 'json'],
    },
    watch: false,
  },
  resolve: {
    alias: [
      { find: '##/', replacement: root + '/' },
    ],
    mainFields: esbuildConfig.mainFields,
  },
  esbuild: transformOptions,
};
