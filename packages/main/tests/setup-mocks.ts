import { vi } from 'vitest';

import { fileURLToPath } from 'node:url';

const path = await vi.importActual<typeof import('node:path')>('node:path');
const tests = path.dirname(fileURLToPath(import.meta.url));

vi.mock('@actions/http-client');
vi.mock('@actions/glob');
vi.mock('@actions/io');
vi.mock('@setup-texlive-action/utils');
vi.mock('#/action/config');
vi.mock('#/action/env');
vi.mock('#/texlive/install-tl/cli');
vi.mock('#/texlive/tlmgr/actions/install');
vi.mock('#/texlive/tlmgr/actions/path');
vi.mock('#/texlive/tlmgr/actions/pinning');
vi.mock('#/texlive/tlmgr/actions/repository');
vi.mock('#/texlive/tlmgr/actions/update');
vi.mock('#/texlive/tlmgr/actions/version');
vi.mock('#/texlive/tlpkg/patch');
vi.mock('#/texlive/tlpkg/util');

for (
  const [parent, modules] of Object.entries({
    '': [
      '@actions/cache',
      '@actions/core',
      '@actions/exec',
      '@actions/tool-cache',
      'unctx',
    ],
    node: [
      'fs/promises',
      'os',
      'path',
      'process',
    ],
    'setup-texlive-action': [
      '#/action/cache',
      '#/action/inputs',
      '#/ctan/mirrors',
      '#/tex/kpse',
      '#/texlive/install-tl/profile',
      '#/texlive/releases',
      '#/texlive/tlmgr/actions/conf',
      '#/texlive/tlmgr/actions/list',
      '#/texlive/tlmgr/internals',
      '#/texlive/tlnet',
    ],
  })
) {
  for (const mod of modules) {
    vi.doMock(mod, async () => {
      return await vi.importActual(
        path.join(
          tests,
          '__mocks__',
          parent,
          mod.replace(/^#/v, ''),
        ),
      );
    });
  }
}
