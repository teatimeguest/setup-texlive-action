// @ts-check
import { createRequire } from 'node:module';

import { compare as semverCompare } from 'semver';

// @ts-expect-error
import nunjucks from '@setup-texlive-action/config/nunjucks/markdown';

const require = createRequire(import.meta.url);
/** @type {typeof import('webpack-license-plugin').default} */
const LicensePlugin = require('webpack-license-plugin');
const allowList = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);
const output = 'NOTICE.md';

/** @type {import('webpack').WebpackPluginFunction} */
export default function pluginLicenses(compiler) {
  const plugin = new LicensePlugin({
    unacceptableLicenseTest: (id) => !allowList.has(id),
    excludedPackageTest: (name) => name.startsWith('@setup-texlive-action/'),
    additionalFiles: {
      [output]: (packages) => {
        console.table(packages, ['name', 'version', 'license']);
        const template = require.resolve(`../nunjucks/${output}.njk`);
        const modules = Object.groupBy(packages, ({ name }) => name);
        for (const [key, value] of Object.entries(modules)) {
          modules[key] = value?.sort((lhs, rhs) => {
            return -semverCompare(lhs.version, rhs.version);
          });
        }
        return nunjucks.render(template, { modules });
      },
    },
  });
  plugin.apply(compiler);

  const name = 'DeleteAssets';
  compiler.hooks.compilation.tap(name, (compilation) => {
    compilation.hooks.afterProcessAssets.tap(name, (assets) => {
      for (const asset of Object.keys(assets)) {
        if (asset !== output) {
          Reflect.deleteProperty(assets, asset);
        }
      }
    });
  });
}
