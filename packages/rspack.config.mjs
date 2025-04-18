import { env } from 'node:process';
import { fileURLToPath } from 'node:url';

import esbuildConfig, { transformConfig } from './config/esbuild.config.mjs';
import pluginLicenses from './config/rspack/plugin-licenses.mjs';

env['FORCE_COLOR'] = '1';

/** @type {import('@rspack/cli').Configuration} */
export default {
  entry: './action',
  output: {
    path: '../dist',
  },
  resolve: {
    conditionNames: esbuildConfig.conditions ?? [],
    extensions: esbuildConfig.resolveExtensions ?? [],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
    mainFields: esbuildConfig.mainFields ?? [],
    tsConfig: fileURLToPath(import.meta.resolve('./tsconfig.json')),
  },
  mode: 'none',
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
