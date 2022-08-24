import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: process.argv.slice(2),
  bundle: true,
  target: 'es2021',
  platform: 'node',
  mainFields: ['module', 'main'],
  conditions: ['module', 'import', 'node', 'default'],
  outdir: 'dist',
  logLevel: 'info',
  logOverride: {
    ['this-is-undefined-in-esm']: 'debug',
  },
});
