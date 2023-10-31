import type {} from 'vitest/globals';

import '#/globals';
import type { Version } from '#/texlive/version';

import { latest } from '#/texlive/release-data.json';

const { env } = await vi.importActual<typeof import('node:process')>(
  'node:process',
);
const prefix = env['npm_config_local_prefix']!;

vi.stubGlobal('LATEST_VERSION', latest.version as Version);
// https://www.rfc-editor.org/rfc/rfc2606.html
vi.stubGlobal('MOCK_URL', 'https://example.com/');
vi.stubGlobal(
  'fixtures',
  async function(name: string): Promise<string> {
    const { readFile } = await vi.importActual<
      typeof import('node:fs/promises')
    >('node:fs/promises');
    const path = await vi.importActual<typeof import('node:path')>('node:path');
    const dir = path.join(prefix, 'tests', 'fixtures');
    return await readFile(path.format({ dir, name }), 'utf8');
  },
);

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
  function fixtures(name: string): Promise<string>;
}

/* eslint no-var: off */
