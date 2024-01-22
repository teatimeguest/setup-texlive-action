import { mergeConfig } from 'vitest/config';

import sharedConfig from '@setup-texlive-action/config/vitest';
import fixtures from '@setup-texlive-action/fixtures';

export default mergeConfig(sharedConfig, {
  plugins: [fixtures()],
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
