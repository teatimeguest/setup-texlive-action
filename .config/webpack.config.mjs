import path from 'node:path';

import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import nunjucks from 'nunjucks';
import slugify from 'slugify';
import spdx from 'spdx-license-list';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import esbuildConfig, { transformOptions } from '##/.config/esbuild.config.mjs';
import nunjucksConfig from '##/.config/nunjucks/config.json' assert {
  type: 'json',
};
import packageJson from '##/package.json' assert { type: 'json' };
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

/** @type {import('webpack').WebpackPluginFunction} */
export function pluginNoEmit(compiler) {
  compiler.hooks.compilation.tap('NoEmit', (compilation) => {
    compilation.hooks.processAssets.tap('NoEmit', (assets) => {
      for (const key of Object.keys(assets)) {
        delete assets[key];
      }
    });
  });
}

/** @type {import('webpack').WebpackPluginFunction} */
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
        const env = nunjucks.configure(nunjucksConfig);
        env.addFilter('slugify', (s) => {
          return slugify(s, {
            remove: /[!-/:-@[-`{-~]/gu,
            lower: true,
          });
        });
        env.addFilter('escape', (s) => s.replaceAll(/[<>]/gu, '\\$&'));
        delete modules
          .find(({ name }) => name === '@azure/core-http')
          ?.packageJson
          ?.['homepage'];
        return env.render(options.templatePath, { modules });
      },
      handleMissingLicenseText: (name, license) => {
        if (options.allowList.has(license)) {
          return `${spdx[license].name} (${spdx[license].url})`;
        } else {
          throw new Error(`Missing license file: ${name} (${license})`);
        }
      },
    });
  }
}

/** @type {import('webpack').Configuration} */
export default {
  entry: path.resolve(tsconfig.compilerOptions.baseUrl),
  output: {
    path: path.resolve(path.dirname(packageJson.main)),
  },
  resolve: {
    extensions: esbuildConfig.resolveExtensions,
    plugins: [
      new TsconfigPathsPlugin({
        extensions: esbuildConfig.resolveExtensions,
      }),
    ],
  },
  mode: 'development',
  target: transformOptions.target,
  externals: Object.keys(esbuildConfig.alias),
  module: {
    rules: [
      {
        test: /\.ts/u,
        loader: 'esbuild-loader',
        options: transformOptions,
      },
    ],
  },
  experiments: {
    topLevelAwait: true,
  },
  optimization: {
    minimize: false,
  },
  stats: 'minimal',
  ignoreWarnings: [
    { message: /Should not import the named export/u },
  ],
  plugins: [
    pluginNoEmit,
    new PluginLicenses({
      allowList: new Set([
        '0BSD',
        'Apache-2.0',
        'BSD-3-Clause',
        'ISC',
        'MIT',
      ]),
      templatePath: './.config/nunjucks/NOTICE.md.njk',
    }),
  ],
};
