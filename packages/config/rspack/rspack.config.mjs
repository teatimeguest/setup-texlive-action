// @ts-check
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';

import esbuildConfig, {
  transformConfig, // @ts-expect-error
} from '@setup-texlive-action/config/esbuild';

import pluginLicenses from './plugin-licenses.mjs';

env['FORCE_COLOR'] = '1';

/** @type {import('@rspack/cli').Configuration} */
export default {
  entry: './packages/action',
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
    tsConfig: fileURLToPath(import.meta.resolve('../../tsconfig.json')),
  },
  mode: 'development',
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
  plugins: [pluginLicenses],
  stats: {
    preset: 'errors-warnings',
    colors: true,
  },
};
