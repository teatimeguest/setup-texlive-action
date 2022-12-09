import { dedent } from 'ts-dedent';

import packageJson from '../package.json' assert { type: 'json' };
import tsconfig from '../tsconfig.json' assert { type: 'json' };

const { outDir, target } = tsconfig.compilerOptions;

export default {
  entryPoints: [outDir],
  bundle: true,
  target,
  format: 'esm',
  platform: 'node',
  mainFields: ['module', 'main'],
  conditions: ['module', 'import'],
  outfile: packageJson.main,
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
