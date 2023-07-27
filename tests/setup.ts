import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import '#/globals';
import { config } from '##/package.json';

const prefix = env['npm_config_local_prefix']!;

declare global {
  var LATEST_VERSION: `202${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
  var MOCK_URL: string;
  function loadFixture(name: string): Promise<string>;
}

globalThis.LATEST_VERSION = config
  .texlive
  .latest
  .version as typeof LATEST_VERSION;

// https://www.rfc-editor.org/rfc/rfc2606.html
globalThis.MOCK_URL = 'https://example.com/';

globalThis.loadFixture = async function(name: string): Promise<string> {
  const dir = path.join(prefix, 'tests', 'fixtures');
  return await fs.readFile(path.format({ dir, name }), 'utf8');
};
