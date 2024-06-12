import { vi } from 'vitest';

import { current } from '@setup-texlive-action/data/texlive-versions.json';
import '@setup-texlive-action/polyfill';

import type { Version } from '#texlive/version';

vi.mock('fs/promises');
vi.mock('os');
vi.mock('path');
vi.mock('process');
vi.mock('@actions/core');
vi.mock('@actions/exec');
vi.mock('@actions/http-client');
vi.mock('@actions/io');
vi.mock('@actions/tool-cache');
vi.mock('@setup-texlive-action/utils');
vi.mock('unctx');
vi.mock('#texlive/ctan/mirrors');
vi.mock('#texlive/install-tl/cli');
vi.mock('#texlive/install-tl/profile');
vi.mock('#texlive/releases');
vi.mock('#texlive/tex/kpse');
vi.mock('#texlive/tlmgr/actions/conf');
vi.mock('#texlive/tlmgr/actions/install');
vi.mock('#texlive/tlmgr/actions/list');
vi.mock('#texlive/tlmgr/actions/path');
vi.mock('#texlive/tlmgr/actions/pinning');
vi.mock('#texlive/tlmgr/actions/repository');
vi.mock('#texlive/tlmgr/actions/update');
vi.mock('#texlive/tlmgr/actions/version');
vi.mock('#texlive/tlmgr/internals');
vi.mock('#texlive/tlnet');
vi.mock('#texlive/tlpkg/patch');
vi.mock('#texlive/tlpkg/util');

vi.stubGlobal('LATEST_VERSION', current.version as Version);
// https://www.rfc-editor.org/rfc/rfc2606.html
vi.stubGlobal('MOCK_URL', 'https://example.com/');

declare global {
  var LATEST_VERSION: Version;
  var MOCK_URL: string;
}

export async function acquire(): Promise<object> {
  return {
    run: vi.fn(),
  };
}
/* eslint no-var: off */
