import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';

import esbuildConfig from '@setup-texlive-action/config/esbuild';

const { values: { release } } = parseArgs({
  options: {
    release: { type: 'boolean', default: false },
  },
});

const { metafile } = await esbuild.build({
  ...esbuildConfig,
  entryPoints: ['./packages/action'],
  tsconfig: './packages/tsconfig.json',
  outfile: './dist/index.mjs',
  metafile: !release,
  sourcemap: release ? false : 'inline',
});

if (metafile != undefined) {
  await writeFile(
    path.join('node_modules', '.esbuild.metadata.txt'),
    await esbuild.analyzeMetafile(metafile, { verbose: true }),
  );
}
