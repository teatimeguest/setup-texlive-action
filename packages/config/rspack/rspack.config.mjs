import { env } from 'node:process';
import { fileURLToPath } from 'node:url';

import esbuildConfig, {
  transformConfig,
} from '@setup-texlive-action/config/esbuild';

import PluginLicenses from './plugin-licenses.mjs';
import pluginNoEmit from './plugin-no-emit.mjs';

env['FORCE_COLOR'] = '1';

/** @type {(relative: string) => string} */
const resolve = (relative) => fileURLToPath(import.meta.resolve(relative));

/** @type {import('@rspack/cli').Configuration} */
export default {
  entry: './packages/main',
  output: {
    path: './dist',
  },
  resolve: {
    conditionNames: esbuildConfig.conditions,
    extensions: esbuildConfig.resolveExtensions,
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    mainFields: esbuildConfig.mainFields,
    tsConfigPath: resolve('../../tsconfig.json'),
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.(ts|json)/v,
        loader: 'esbuild-loader',
        options: transformConfig,
        type: 'javascript/auto',
      },
    ],
  },
  target: transformConfig.target,
  externals: Object.keys(esbuildConfig.alias ?? {}),
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
      templatePath: resolve('../nunjucks/NOTICE.md.njk'),
    }),
  ],
  stats: {
    preset: 'errors-warnings',
    colors: true,
  },
};
