import path from 'node:path';

import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import esbuildConfig, {
  transformConfig,
} from '@setup-texlive-action/config/esbuild';

import PluginLicenses from './plugins/licenses.mjs';
import pluginNoEmit from './plugins/no-emit.mjs';

/** @type {import('webpack').Configuration} */
export default {
  entry: path.resolve('./packages/main/src/index.ts'),
  output: {
    path: path.resolve('./dist'),
  },
  resolve: {
    extensions: esbuildConfig.resolveExtensions,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    plugins: [
      new TsconfigPathsPlugin({
        configFile: './packages/tsconfig.json',
        extensions: esbuildConfig.resolveExtensions,
      }),
    ],
  },
  mode: 'development',
  target: transformConfig.target,
  externals: Object.keys(esbuildConfig.alias),
  module: {
    rules: [
      {
        test: /\.ts/u,
        loader: 'esbuild-loader',
        options: transformConfig,
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
      templatePath: './packages/config/nunjucks/NOTICE.md.njk',
    }),
  ],
};
