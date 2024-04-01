/** @type {import('esbuild').CommonOptions} */
export const transformConfig = {
  target: 'node20',
  format: 'esm',
  platform: 'node',
  legalComments: 'inline',
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
  alias: {
    // This reduces the script size by about 350kb.
    'whatwg-url': 'node:url',
  },
  resolveExtensions: ['.ts', '.mjs', '.js', '.json'],
  logLevel: 'info',
};
