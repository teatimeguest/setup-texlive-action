import { vi } from 'vitest';

import { fileURLToPath } from 'node:url';

import '@setup-texlive-action/config/vitest/setup-jest-extended.js';

import '#/globals';
import type { Version } from '#/texlive/version';

import { latest } from '#/texlive/release-data.json';

const path = await vi.importActual<typeof import('node:path')>('node:path');
const tests = path.dirname(fileURLToPath(import.meta.url));

vi.stubGlobal('LATEST_VERSION', latest.version as Version);
// https://www.rfc-editor.org/rfc/rfc2606.html
vi.stubGlobal('MOCK_URL', 'https://example.com/');
vi.stubGlobal(
  'fixtures',
  async function(name: string): Promise<string> {
    const { readFile } = await vi.importActual<
      typeof import('node:fs/promises')
    >('node:fs/promises');
    const dir = path.join(tests, 'fixtures');
    return await readFile(path.format({ dir, name }), 'utf8');
  },
);

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
  function fixtures(name: string): Promise<string>;
}

/* eslint no-var: off */
