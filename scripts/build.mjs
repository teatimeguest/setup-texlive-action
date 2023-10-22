import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';

import esbuildConfig from '##/.config/esbuild.config.mjs';
import packageJson from '##/package.json' assert { type: 'json' };
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

const { baseUrl, outDir } = tsconfig.compilerOptions;
const { values: { release } } = parseArgs({
  options: {
    release: { type: 'boolean', default: false },
  },
});

const { metafile } = await esbuild.build({
  ...esbuildConfig,
  entryPoints: [baseUrl],
  outfile: packageJson.main,
  metafile: !release,
  sourcemap: release ? false : 'inline',
});

if (metafile != undefined) {
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'metadata.txt'),
    await esbuild.analyzeMetafile(metafile, { verbose: true }),
  );
}
