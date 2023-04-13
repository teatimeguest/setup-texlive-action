import { dedent } from 'ts-dedent';

import tsconfig from '##/tsconfig.json' assert { type: 'json' };

const { target } = tsconfig.compilerOptions;

export default {
  bundle: true,
  target,
  format: 'esm',
  platform: 'node',
  mainFields: ['module', 'main'],
  conditions: ['module', 'import'],
  banner: {
    // https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    js: dedent`
      import { createRequire } from 'node:module';
      const require = createRequire(import.meta.url);
    `,
  },
  legalComments: 'none',
  alias: { 'whatwg-url': 'node:url' }, // This reduces the script size by 10%.
  logLevel: 'info',
};
