import { vi } from 'vitest';

import { current } from '@setup-texlive-action/data/texlive-versions.json';

import '#/globals';
import type { Version } from '#/texlive/version';

vi.stubGlobal('LATEST_VERSION', current.version as Version);
// https://www.rfc-editor.org/rfc/rfc2606.html
vi.stubGlobal('MOCK_URL', 'https://example.com/');

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
}

/* eslint no-var: off */
