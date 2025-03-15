// @ts-check
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { compare as semverCompare } from 'semver';
import spdx from 'spdx-license-list';
import LicensePlugin from 'webpack-license-plugin';
/**
 * @typedef
 *   {Required<NonNullable<ConstructorParameters<typeof LicensePlugin>[0]>>}
 *   IPluginOptions
 * @typedef
 *   {Parameters<IPluginOptions['additionalFiles'][string]>[0][number]}
 *   IPackageLicenseMeta
 */

import nunjucks from '../nunjucks/markdown.mjs';

const allowList = new Set([
  '(Apache-2.0 AND BSD-3-Clause)',
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);
const output = 'NOTICE.md';
const templatePath = fileURLToPath(
  import.meta.resolve(`../nunjucks/${output}.njk`),
);

/** @type {import('webpack').WebpackPluginFunction} */
export default function pluginLicenses(compiler) {
  const plugin = new LicensePlugin({
    unacceptableLicenseTest: (id) => !allowList.has(id),
    excludedPackageTest: (name) => name.startsWith('@setup-texlive-action/'),
    additionalFiles: { [output]: render },
    includeNoticeText: true,
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

/**
 * @param {IPackageLicenseMeta[]} packages
 * @returns {string}
 */
function render(packages) {
  assert.notEqual(packages.length, 0, 'No packages found');
  console.table(packages, ['name', 'version', 'license']);
  for (const { name, version, noticeText } of packages) {
    assert.equal(noticeText, undefined, `${name}@${version} has notice text`);
  }
  /** @type {Partial<{ [name: string]: IPackageLicenseMeta[] }>} */
  const modules = Object.groupBy(packages, ({ name }) => name);
  for (const [key, value] of Object.entries(modules)) {
    modules[key] = value?.sort((lhs, rhs) => {
      return -semverCompare(lhs.version, rhs.version);
    });
  }
  return nunjucks.render(templatePath, { modules, spdx });
}
