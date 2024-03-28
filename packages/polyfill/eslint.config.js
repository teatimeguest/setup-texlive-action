import {
  common,
  defineConfig,
  sources,
} from '@setup-texlive-action/config/eslint';

export default defineConfig({
  files: ['src/**/*.ts'],
  extends: [...common, ...sources],
});
