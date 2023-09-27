import { build, buildSync } from 'esbuild';

import { transformOptions } from '##/.config/esbuild.config.mjs';

const config = (contents) => ({
  ...transformOptions,
  bundle: false,
  format: 'cjs',
  stdin: { contents, loader: 'ts', resolveDir: process.cwd() },
  write: false,
});

export default {
  process: (contents) => {
    const { outputFiles } = buildSync(config(contents));
    return { code: outputFiles[0].text };
  },
  processAsync: async (contents) => {
    const { outputFiles } = await build(config(contents));
    return { code: outputFiles[0].text };
  },
};
