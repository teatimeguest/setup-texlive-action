import { vi } from 'vitest';

import '#action/global';

import versions from '@setup-texlive-action/data/texlive-versions.json' with {
  type: 'json',
};
import type { Version } from '@setup-texlive-action/texlive';

vi.mock('fs/promises');
vi.mock('os');
vi.mock('path');
vi.mock('process');
vi.mock('@actions/cache');
vi.mock('@actions/core');
vi.mock('@actions/glob');
vi.mock('@actions/http-client');
vi.mock('@setup-texlive-action/texlive');
vi.mock('@setup-texlive-action/utils');
vi.mock('source-map-support/register');
vi.mock('unctx');
vi.mock('#action/cache');
vi.mock('#action/env');
vi.mock('#action/inputs');
vi.mock('#action/runs/main/config');
vi.mock('#action/runs/main/install');
vi.mock('#action/runs/main/update');

vi.stubGlobal('LATEST_VERSION', versions.current.version as Version);
// https://www.rfc-editor.org/rfc/rfc2606.html
vi.stubGlobal('MOCK_URL', 'https://example.com/');

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
}

/* eslint no-var: off */
