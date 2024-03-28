import {
  common,
  defineConfig,
  sources,
  tests,
} from '@setup-texlive-action/config/eslint';

const mockfiles = 'src/__mocks__/**/*.ts';

export default defineConfig(
  {
    files: ['src/**/*.ts'],
    ignores: [mockfiles],
    extends: [...common, ...sources],
  },
  {
    files: ['__tests__/**/*.ts', mockfiles],
    extends: [...common, ...tests],
  },
);
