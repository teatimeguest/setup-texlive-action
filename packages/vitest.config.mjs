import { mergeConfig } from 'vitest/config';

import sharedConfig from '@setup-texlive-action/config/vitest';

export default mergeConfig(sharedConfig, {
  test: {
    include: [],
    workspace: [
      '*/vitest.config.{js,mjs,ts}',
      '!e2e/vitest.config.mjs',
    ],
    server: {
      deps: {
        cacheDir: '../node_modules/.vite',
      },
    },
    coverage: {
      enabled: true,
      include: ['*/src/**/*.ts'],
      exclude: ['**/__mocks__/**', '**/*.d.ts'],
      reportsDirectory: '../coverage',
    },
  },
});
