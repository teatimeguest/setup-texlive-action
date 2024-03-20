import path from 'node:path';
import { env } from 'node:process';

import esbuildConfig, {
  transformConfig,
} from '@setup-texlive-action/config/esbuild';

import PluginLicenses from './plugins/licenses.mjs';
import pluginNoEmit from './plugins/no-emit.mjs';

env['FORCE_COLOR'] = '1';

/** @type {import('@rspack/cli').Configuration} */
export default {
  entry: path.resolve('./packages/main/src/index.ts'),
  output: {
    path: path.resolve('./dist'),
  },
  resolve: {
    conditionNames: esbuildConfig.conditions,
    extensions: esbuildConfig.resolveExtensions,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    mainFields: esbuildConfig.mainFields,
    tsConfigPath: path.resolve('./packages/tsconfig.json'),
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.ts/v,
        loader: 'esbuild-loader',
        options: transformConfig,
      },
    ],
  },
  target: transformConfig.target,
  externals: Object.keys(esbuildConfig.alias),
  optimization: {
    minimize: false,
  },
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
  stats: {
    preset: 'errors-warnings',
    colors: true,
  },
};
