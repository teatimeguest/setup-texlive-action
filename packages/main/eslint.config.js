import { common, sources, tests } from '@setup-texlive-action/config/eslint';

const sourcefiles = 'src/**/*.ts';
const testfiles = 'tests/**/*.ts';

export default [
  {
    ignores: ['src/index.ts', 'src/**/*.d.ts'],
  },
  ...common.map((config) => ({ files: [sourcefiles, testfiles], ...config })),
  ...sources.map((config) => ({ files: [sourcefiles], ...config })),
  ...tests.map((config) => ({ files: [testfiles], ...config })),
];
