import path from 'node:path';

import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import esbuildConfig from '##/.config/esbuild.config.mjs';
import tsconfig from '##/tsconfig.json' assert { type: 'json' };

const {
  bundle,
  mainFields,
  conditions,
  banner,
  alias,
  ...transformOptions
} = esbuildConfig;

export function pluginNoEmit(compiler) {
  compiler.hooks.afterCompile.tap('NoEmit', (compilation) => {
    compilation.assets = [];
  });
}

const resolvedExtensions = ['.ts', '.js'];

export default {
  entry: path.resolve(tsconfig.compilerOptions.baseUrl),
  resolve: {
    extensions: resolvedExtensions,
    plugins: [new TsconfigPathsPlugin({ extensions: resolvedExtensions })],
  },
  output: { path: path.resolve(tsconfig.compilerOptions.outDir) },
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
};
