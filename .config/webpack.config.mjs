import path from 'node:path';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';

const allowlist = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);

export default {
  entry: './lib/index.js',
  output: { path: path.join(process.cwd(), 'lib') },
  mode: 'development',
  target: 'node',
  resolve: { alias: { '#': '.' } },
  externals: 'whatwg-url',
  plugins: [
    ({ hooks: { compilation } }) => {
      compilation.tap('no emit', ({ hooks: { processAssets } }) => {
        processAssets.tap('no emit', (assets) => {
          for (const name of Object.keys(assets)) {
            delete assets[name];
          }
        });
      });
    },
    new LicenseWebpackPlugin({
      outputFilename: 'licenses.js',
      unacceptableLicenseTest: (license) => !allowlist.has(license),
      renderLicenses: (modules) => modules
        .map(({ packageJson: { name, author }, licenseId, licenseText }) => {
          if (author?.name) {
            const email = author.email ? ` <${author.email}>` : '';
            const url = author.url ? ` (${author.url})` : '';
            author = author.name + email + url;
          }
          return { name, author, id: licenseId, text: licenseText };
        })
        .sort((lhs, rhs) => lhs.name < rhs.name ? -1 : 1)
        .flatMap(({ name, author, id, text }) => [
          '/*!',
          ` * ${name}${author ? ` - Copyright (c) ${author}` : ''}`,
          ' *',
          text.trimEnd().replaceAll(/^/gmu, ' * ').replaceAll(/\s+$/gmu, ''),
          ' */'
        ])
        .join('\n'),
    }),
  ],
  stats: 'minimal',
};
