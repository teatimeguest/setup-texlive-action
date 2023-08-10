import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import '#/globals';
import type { Version } from '#/texlive/version';

import { latest } from '#/texlive/release-data.json';

const prefix = env['npm_config_local_prefix']!;

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
  function loadFixture(name: string): Promise<string>;
}

globalThis.LATEST_VERSION = latest.version as typeof LATEST_VERSION;

// https://www.rfc-editor.org/rfc/rfc2606.html
globalThis.MOCK_URL = 'https://example.com/';

globalThis.loadFixture = async function(name: string): Promise<string> {
  const dir = path.join(prefix, 'tests', 'fixtures');
  return await fs.readFile(path.format({ dir, name }), 'utf8');
};
