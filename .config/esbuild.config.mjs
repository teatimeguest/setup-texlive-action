import { dedent } from 'ts-dedent';

export const transformOptions = {
  target: 'node16',
  format: 'esm',
  platform: 'node',
  legalComments: 'none',
  logLevel: 'info',
};

export default {
  ...transformOptions,
  bundle: true,
  mainFields: ['module', 'main'],
  conditions: ['module', 'import'],
  banner: {
    // https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    js: dedent`
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
    `,
  },
  alias: {
    // See: teatimeguest/setup-texlive-action#255
    '@azure/abort-controller': '#/shim/abort-controller',
    // This reduces the script size by 10%.
    'whatwg-url': 'node:url',
  },
  resolveExtensions: ['.ts', '.mjs', '.js', '.json'],
};
