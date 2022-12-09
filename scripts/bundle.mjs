import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import esbuild from 'esbuild';

import config from '../.config/esbuild.config.mjs';
import tsconfig from '../tsconfig.json' assert { type: 'json' };

const { metafile } = await esbuild.build({ ...config, metafile: true });

await writeFile(
  path.join(tsconfig.compilerOptions.outDir, '.metadata'),
  await esbuild.analyzeMetafile(metafile, { verbose: true }),
);
