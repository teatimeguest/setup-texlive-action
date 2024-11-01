// @ts-check
/** @satisfies {import('esbuild').CommonOptions} */
export const transformConfig = {
  /** @type {'node20'} */
  target: 'node20',
  format: 'esm',
  platform: 'node',
  legalComments: 'inline',
  keepNames: true,
};

const requireShim = String.raw`
await import('node:module').then(({ createRequire }) => {
  Object.defineProperty(globalThis, 'require', {
    value: createRequire(import.meta.url),
    configurable: false,
    enumerable: false,
    writable: false,
  });
});
`;

/** @type {import('esbuild').BuildOptions} */
export default {
  ...transformConfig,
  bundle: true,
  mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  conditions: ['bundler', 'import', 'module'],
  banner: {
    // See: https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    js: requireShim.trim(),
  },
  resolveExtensions: ['.ts', '.mjs', '.js', '.json'],
  logLevel: 'info',
};
