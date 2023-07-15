import path from 'node:path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import nunjucks from 'nunjucks';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import { transformOptions } from '##/.config/esbuild.config.mjs';
import nunjucksConfig from '##/.config/nunjucks/config.json' assert {
  type: 'json',
};
import packageJson from '##/package.json' assert { type: 'json' };
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

export function pluginNoEmit(compiler) {
  compiler.hooks.compilation.tap('NoEmit', (compilation) => {
    compilation.hooks.processAssets.tap('NoEmit', (assets) => {
      for (const key of Object.keys(assets)) {
        delete assets[key];
      }
    });
  });
}

export function pluginNoOutput(compiler) {
  compiler.hooks.afterCompile.tap('NoOutput', (compilation) => {
    compilation.assets = [];
  });
}

export class PluginLicenses extends LicenseWebpackPlugin {
  /**
   * @param {object} options
   * @param {Set<string>} options.allowList
   * @param {string} options.templatePath
   */
  constructor(options) {
    super({
      outputFilename: path.basename(options.templatePath, '.njk'),
      unacceptableLicenseTest: (license) => {
        return !options.allowList.has(license);
      },
      renderLicenses: (data) => {
        const modules = data.sort((lhs, rhs) => lhs.name < rhs.name ? -1 : 1);
        console.table(
          Object.fromEntries(modules.map((m) => [m.name, m.licenseId])),
        );
        return nunjucks.configure(nunjucksConfig).render(
          options.templatePath,
          { modules },
        );
      },
      handleMissingLicenseText: (name, license) => {
        switch (license) {
          case 'MIT':
            return 'The MIT License (https://opensource.org/license/mit/)';
          default:
            throw new Error(`Missing license file: ${name}`);
        }
      },
    });
  }
}

const resolvedExtensions = ['.ts', '.js'];

const allowList = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-3-Clause',
  'ISC',
  'MIT',
]);
const templatePath = './.config/nunjucks/NOTICE.md.njk';

export default {
  entry: path.resolve(tsconfig.compilerOptions.baseUrl),
  output: {
    path: path.resolve(path.dirname(packageJson.main)),
  },
  resolve: {
    extensions: resolvedExtensions,
    plugins: [
      new TsconfigPathsPlugin({ extensions: resolvedExtensions }),
    ],
  },
  mode: 'development',
  target: 'node',
  externals: 'whatwg-url',
  module: {
    rules: [
      {
        test: /\.ts/u,
        loader: 'esbuild-loader',
        options: transformOptions,
      },
    ],
  },
  experiments: { topLevelAwait: true },
  stats: 'minimal',
  ignoreWarnings: [
    { message: /Should not import the named export/u },
  ],
  plugins: [
    pluginNoEmit,
    new PluginLicenses({ allowList, templatePath }),
  ],
};
