import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import esbuild from 'esbuild';

import esbuildConfig from '##/.config/esbuild.config.mjs';

const script = path.basename(fileURLToPath(import.meta.url), '');

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
  const dotenv = fileURLToPath(import.meta.resolve('##/tests/e2e/.env'));
  const { status, signal } = spawnSync('node', [
    `--env-file=${path.relative('.', dotenv)}`,
    '--',
    main,
    ...args,
  ], {
    stdio: 'inherit',
  });
  return status ?? (signal + 128);
};

/** @returns {Promise<number>} */
const run = async () => {
  const { positionals } = parseArgs({ allowPositionals: true });
  if (positionals.length === 0) {
    console.error(`USAGE: ${script} main.ts [...]`);
    return 1;
  }
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
      return 1;
    }
    return await node(outfile, args);
  }
};

process.exit(await run());
