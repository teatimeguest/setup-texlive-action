import { mergeConfig } from 'vitest/config';

import sharedConfig from '@setup-texlive-action/config/vitest';

export default mergeConfig(sharedConfig, {
  test: {
    include: [],
    coverage: {
      enabled: true,
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
