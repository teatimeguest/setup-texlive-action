import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import { config } from '##/package.json';

async function loadFixture(name: string): Promise<string> {
  const dir = path.join(
    env['npm_config_local_prefix'] ?? '.',
    'tests',
    'fixtures',
  );
  return await fs.readFile(path.format({ dir, name }), 'utf8');
}

declare global {
  function loadFixture(name: string): Promise<string>;
  var LATEST_VERSION: `202${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
}

globalThis.loadFixture = loadFixture;
globalThis.LATEST_VERSION = config
  .texlive
  .latest
  .version as typeof LATEST_VERSION;

// const loadFixtures = (): Record<string, string> => {
//   const fs = jest.requireActual('node:fs');
//   const path = jest.requireActual('node:path');
//   const { env } = jest.requireActual('node:process');
//   const dir = path.join(env.npm_config_local_prefix, 'tests', 'fixtures');
//   const fixtures: Record<string, string> = {};
//   for (const name of fs.readdirSync(dir)) {
//     fixtures[name] = fs.readFileSync(path.format({ dir, name }), 'utf8');
//   }
//   return fixtures;
// };
