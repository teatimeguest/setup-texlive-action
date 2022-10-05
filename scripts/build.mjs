import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import esbuild from 'esbuild';
import webpack from 'webpack';

import esbuildConfig from '../.config/esbuild.config.mjs';
import webpackConfig from '../.config/webpack.config.mjs';

await new Promise((resolve, reject) => {
  spawn('ttsc', { stdio: 'inherit' })
    .on('error', reject)
    .on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ttsc exited with ${code}`));
      }
    });
});

if (new Set(process.argv).has('--release')) {
  await new Promise((resolve, reject) => {
    webpack(webpackConfig, (error, stats) => {
      if (error) {
        reject(error);
      }
      const info = stats.toJson();
      for (const warning of info.warnings) {
        console.warn(warning);
      }
      if (stats.hasErrors()) {
        reject(new AggregateError(info.errors));
      }
      resolve();
    });
  });
  esbuildConfig.plugins.push({
    name: 'Append licenses',
    setup: async ({ initialOptions }) => {
      initialOptions.footer = { js: await readFile('lib/licenses.js') };
    },
  });
}

await esbuild.build(esbuildConfig);
