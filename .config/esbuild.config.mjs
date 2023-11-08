import { readFileSync } from 'node:fs';

/** @type {import('esbuild').TransformOptions} */
export const transformOptions = {
  target: 'node20',
  format: 'esm',
  platform: 'node',
  legalComments: 'inline',
  logLevel: 'info',
};

/** @type {import('esbuild').BuildOptions} */
export default {
  ...transformOptions,
  bundle: true,
  mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  conditions: ['import', 'module'],
  banner: {
    // See: https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    get js() {
      return readFileSync(
        new URL(import.meta.resolve('##/src/polyfill/shim/require.mjs')),
        'utf8',
      );
    },
  },
  alias: {
    // See: teatimeguest/setup-texlive-action#255
    '@azure/abort-controller': '#/polyfill/pure/abort-controller',
    // This reduces the script size by about 350kb.
    'whatwg-url': 'node:url',
  },
  resolveExtensions: ['.ts', '.mjs', '.js', '.json'],
};
