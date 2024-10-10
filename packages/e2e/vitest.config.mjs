import { mergeConfig } from 'vitest/config';

import defaultConfig from '@setup-texlive-action/config/vitest';

export default mergeConfig(defaultConfig, {
  test: {
    testTimeout: 5 * 60 * 1000, // 5min
  },
});
