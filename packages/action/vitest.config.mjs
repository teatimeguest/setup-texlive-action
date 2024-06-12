import { mergeConfig } from 'vitest/config';

import sharedConfig from '@setup-texlive-action/config/vitest';
import fixtures from '@setup-texlive-action/fixtures';

export default mergeConfig(sharedConfig, {
  plugins: [fixtures()],
  test: {
    setupFiles: ['__tests__/setup.ts'],
  },
});
