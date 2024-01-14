import { common, sources } from '@setup-texlive-action/config/eslint';

const sourcefiles = 'src/**/*.ts';

export default [
  ...common.map((config) => ({ files: [sourcefiles], ...config })),
  ...sources.map((config) => ({ files: [sourcefiles], ...config })),
];
