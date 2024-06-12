import path from 'node:path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import spdx from 'spdx-license-list';

import nunjucks from '@setup-texlive-action/config/nunjucks/markdown';

/**
 * @typedef PluginOptions
 * @type {object}
 * @property {Set<string>} allowList
 * @property {string} templatePath
 * @property {?string} outputFilename
 */

export default class PluginLicenses extends LicenseWebpackPlugin {
  /** @param {PluginOptions} options */
  constructor(options) {
    const outputFilename = options.outputFilename
      ?? path.basename(options.templatePath, '.njk');

    /**
     * @param {string} license
     * @returns {boolean}
     */
    function unacceptableLicenseTest(license) {
      return !options.allowList.has(license);
    }

    /**
     * @param
     *   {import('license-webpack-plugin/dist/LicenseIdentifiedModule.js')
     *     .LicenseIdentifiedModule[]}
     *   data
     * @returns {string}
     */
    function renderLicenses(data) {
      const modules = data
        .sort((lhs, rhs) => lhs.name < rhs.name ? -1 : 1)
        .map((m) => {
          switch (m.name) {
            case 'temporal-polyfill':
              // Remove dummy text (see below).
              delete m.licenseText;
              break;
          }
          return m;
        });
      console.table(
        Object.fromEntries(modules.map((m) => [m.name, m.licenseId])),
      );
      return nunjucks.render(options.templatePath, { modules, spdx });
    }

    /**
     * @param {string} name
     * @returns {boolean}
     */
    function excludedPackageTest(name) {
      return name.startsWith('@setup-texlive-action');
    }

    super({
      outputFilename,
      unacceptableLicenseTest,
      renderLicenses,
      excludedPackageTest,
      licenseFileOverrides: {
        // This package does not contain a license file and `rspack` will fail,
        // so uses a fake file temporarily.
        'temporal-polyfill': 'package.json',
      },
    });
  }
}
