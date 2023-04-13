import path from 'node:path';

import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';

import tsconfig from '##/tsconfig.json' assert { type: 'json' };

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
        options: { target: tsconfig.compilerOptions.target },
      },
    ],
  },
  stats: 'minimal',
};
