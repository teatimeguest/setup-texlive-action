import config, { defineConfig } from '@setup-texlive-action/config/eslint';

const sourcefiles = '*/src/**/*.ts';
const mockfiles = '**/__mocks__/**/*.ts';

export default defineConfig(
  {
    files: [sourcefiles],
    ignores: [mockfiles],
    extends: [...config.common, ...config.sources],
  },
  {
    files: [sourcefiles],
    ignores: [mockfiles, 'action/**', 'texlive/**', 'utils/**'],
    extends: config.docs,
  },
  {
    files: ['*/__tests__/**/*.ts', mockfiles],
    ignores: [],
    extends: [...config.common, ...config.tests],
  },
);
