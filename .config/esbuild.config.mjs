import tsconfig from '../tsconfig.json' assert { type: 'json' };

export default {
  entryPoints: ['./lib/index.js'],
  bundle: true,
  target: tsconfig.target,
  format: 'esm',
  platform: 'node',
  mainFields: ['module', 'main'],
  conditions: ['module', 'import'],
  outfile: 'dist/index.mjs',
  banner: {
    // https://github.com/evanw/esbuild/issues/1921#issuecomment-1152991694
    js: "import { createRequire } from 'node:module';\n"
      + 'const require = createRequire(import.meta.url);',
  },
  legalComments: 'none',
  plugins: [{
    name: "Resolve imports through TS's path mapping",
    setup: ({ onResolve, resolve }) => {
      onResolve({ filter: /^#\// }, ({ path, ...options }) => {
        return resolve(path.replace('#', '.'), options);
      });
    },
  }, {
    // This reduces the script size by 10%.
    name: 'Replace `whatwg-url` with the Node.js `url` module',
    setup: ({ onResolve, onLoad }) => {
      onResolve({ filter: /^whatwg-url$/ }, () => {
        return { path: 'url', namespace: 'node' };
      });
      onLoad({ filter: /^url$/, namespace: 'node' }, async () => {
        return {
          contents: "export { default, URL, URLSearchParams } from 'node:url';",
        };
      });
    },
  }],
  logLevel: 'info',
};
