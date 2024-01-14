import { mergeConfig } from 'vitest/config';

import sharedConfig from '@setup-texlive-action/config/vitest';

export default mergeConfig(sharedConfig, {
  test: {
    include: [
      'tests/__tests__/**/*.test.ts',
    ],
    setupFiles: [
      'tests/setup-globals.ts',
      'tests/setup-mocks.ts',
    ],
  },
});
