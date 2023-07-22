import { dedent } from 'ts-dedent';

export const transformOptions = {
  target: 'node16',
  format: 'esm',
  platform: 'node',
  keepNames: true,
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
  alias: { 'whatwg-url': 'node:url' }, // This reduces the script size by 10%.
};
