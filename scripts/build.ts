import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import esbuild from 'esbuild';
import { dedent } from 'ts-dedent';

import esbuildConfig from '##/.config/esbuild.config.mjs';
import packageJson from '##/package.json' assert { type: 'json' };
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

import { type Module, listLicenses, showLicenses } from './licenses.js';

const renderLicenses = (modules: Array<Module>) => {
  console.group();
  showLicenses(modules);
  console.groupEnd();
  const line = /^.*/gmu;
  return modules
    .map(({ name, author, licenseText }) => {
      return dedent`
        /*!
         * ${name}${author ? ` - Copyright (c) ${author}` : ''}
         *
        ${licenseText.trimEnd().replaceAll(line, (l) => ` * ${l}`.trimEnd())}
         */
      `;
    })
    .join('\n');
};

const { baseUrl, outDir } = tsconfig.compilerOptions;

if (env.npm_lifecycle_event === 'build-release') {
  esbuildConfig.footer = { js: renderLicenses(await listLicenses()) };
}

const { metafile } = await esbuild.build(
  {
    ...esbuildConfig,
    entryPoints: [baseUrl],
    outfile: packageJson.main,
    metafile: true,
  } as esbuild.BuildOptions,
);

await mkdir(outDir, { recursive: true });

await writeFile(
  path.join(outDir, '.metadata'),
  await esbuild.analyzeMetafile(metafile!, { verbose: true }),
);
