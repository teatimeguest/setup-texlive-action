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
  /** @param {PluginLicensesOptions} options */
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
     * @param {string} name
     * @param {string} license
     * @returns {string}
     */
    function handleMissingLicenseText(name, license) {
      return `${spdx[license].name} (${spdx[license].url})`;
    }

    /**
     * @param
     *   {import('license-webpack-plugin/dist/LicenseIdentifiedModule')
     *     .LicenseIdentifiedModule[]}
     *   data
     * @returns {string}
     */
    function renderLicenses(data) {
      const modules = data.sort((lhs, rhs) => lhs.name < rhs.name ? -1 : 1);
      console.table(
        Object.fromEntries(modules.map((m) => [m.name, m.licenseId])),
      );
      delete modules
        .find(({ name }) => name === '@azure/core-http')
        ?.packageJson
        ?.['homepage'];
      return nunjucks.render(options.templatePath, { modules });
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
      handleMissingLicenseText,
      renderLicenses,
      excludedPackageTest,
    });
  }
}
