import { appendFile } from 'node:fs/promises';
import path from 'node:path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import { dedent } from 'ts-dedent';

import packageJson from '../package.json' assert { type: 'json' };
import tsconfig from '../tsconfig.json' assert { type: 'json' };

const allowlist = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);

const renderLicenses = (modules) => {
  const maxLength = Math.max(...modules.map((m) => m.packageJson.name.length));
  const line = /^.*/gmu;
  console.error('PACKAGE'.padEnd(maxLength), 'LICENSE');
  return modules
    .sort((lhs, rhs) => lhs.packageJson.name < rhs.packageJson.name ? -1 : 1)
    .map(({ packageJson: { name, author }, licenseId, licenseText }) => {
      console.error(name.padEnd(maxLength), licenseId);

      author = [
        author?.name ?? author,
        author?.email?.replace(/.*/u, '<$&>'),
        author?.url?.replace(/.*/u, '($&)'),
      ].filter(Boolean).join(' ');

      return dedent`
        /*!
         * ${name}${author ? ` - Copyright (c) ${author}` : ''}
         *
        ${licenseText.trimEnd().replaceAll(line, (l) => ` * ${l}`.trimEnd())}
         */
      `;
    })
    .join('\n');
}

const assetName = 'licenses.js';
const lib = path.resolve(tsconfig.compilerOptions.outDir);

const pluginLicense = new LicenseWebpackPlugin({
  outputFilename: assetName,
  unacceptableLicenseTest: (license) => !allowlist.has(license),
  renderLicenses,
});

const pluginAddLegalComments = ({ hooks: { afterCompile } }) => {
  afterCompile.tapPromise('AddLegalComments', async (compilation) => {
    const source = compilation.getAsset(assetName).source.source();
    await appendFile(packageJson.main, source);
    compilation.assets = [];
  });
};

export default {
  entry: lib,
  output: { path: lib },
  mode: 'development',
  target: 'node',
  externals: 'whatwg-url',
  plugins: [pluginLicense, pluginAddLegalComments],
  stats: 'minimal',
};
