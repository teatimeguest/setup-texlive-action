import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';

import esbuildConfig from '##/.config/esbuild.config.mjs';
import packageJson from '##/package.json' assert { type: 'json' };
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

const { baseUrl, outDir } = tsconfig.compilerOptions;
const { values } = parseArgs({
  options: {
    input: {
      type: 'string',
      short: 'i',
      default: baseUrl,
    },
    output: {
      type: 'string',
      short: 'o',
      default: packageJson.main,
    },
  },
});

const { metafile } = await esbuild.build({
  ...esbuildConfig,
  entryPoints: [values.input],
  outfile: values.output,
  metafile: values.input === baseUrl,
});

if (metafile != undefined) {
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'metadata.txt'),
    await esbuild.analyzeMetafile(metafile, { verbose: true }),
  );
}
