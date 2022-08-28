import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: process.argv.slice(2),
  bundle: true,
  target: 'es2021',
  platform: 'node',
  mainFields: ['module', 'main'],
  conditions: ['module', 'import', 'node', 'default'],
  outdir: 'dist',
  plugins: [{
    name: 'resolvePath',
    setup: ({ onResolve, resolve }) => onResolve(
      { filter: /^#\// },
      ({ path, ...options }) => resolve(path.replace('#', '.'), options),
    ),
  }],
  logLevel: 'info',
  logOverride: {
    ['this-is-undefined-in-esm']: 'debug',
  },
});
