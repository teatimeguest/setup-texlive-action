import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';

import esbuildConfig from '##/.config/esbuild.config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const script = path.basename(scriptPath, '');
const localPrefix = path.normalize(path.join(path.dirname(scriptPath), '..'));

/** @yields {string} */
const mkdtemp = async function*() {
  const prefix = path.join(os.tmpdir(), `${script}-`);
  const tmpdir = await fs.mkdtemp(prefix);
  try {
    yield tmpdir;
  } finally {
    await fs.rm(tmpdir, { recursive: true });
  }
};

/**
 * @param {string} input
 * @param {Iterable<string>} args
 * @return {Promise<number>}
 */
const node = async (main, args) => {
  const { status, signal } = spawnSync('node', [
    `--env-file=${path.join(localPrefix, 'tests', 'e2e', '.env')}`,
    '--',
    main,
    ...args,
  ], {
    stdio: 'inherit',
  });
  return process.exitCode = status ?? (signal + 128);
};

const { positionals } = parseArgs({ allowPositionals: true });
assert.notEqual(positionals.length, 0, `USAGE: ${script} main.ts [...]`);
const [input, ...args] = positionals;

for await (const tmpdir of mkdtemp()) {
  const outfile = path.format({
    dir: tmpdir,
    name: path.basename(input),
    ext: '.mjs',
  });
  try {
    await esbuild.build({
      ...esbuildConfig,
      entryPoints: [input],
      outfile,
      minify: true,
      keepNames: true,
      sourcemap: 'inline',
      logLevel: 'warning',
    });
  } catch {
    process.exit(1);
  }
  await node(outfile, args);
}
