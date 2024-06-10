import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { env } from 'node:process';

import esbuild from 'esbuild';

import esbuildConfig from '@setup-texlive-action/config/esbuild';

const packageJson = createRequire(import.meta.url)(env.npm_package_json);

const { metafile } = await esbuild.build({
  ...esbuildConfig,
  entryPoints: ['./packages/action'],
  tsconfig: './packages/tsconfig.json',
  outfile: packageJson.main,
  sourcemap: 'linked',
  metafile: true,
});

const outdir = path.join('node_modules', '.esbuild');
await mkdir(outdir, { recursive: true });
await writeFile(
  path.join(outdir, 'meta.json'),
  JSON.stringify(metafile, undefined, 2),
);
await writeFile(
  path.join(outdir, 'meta.txt'),
  await esbuild.analyzeMetafile(metafile, { verbose: true }),
);
