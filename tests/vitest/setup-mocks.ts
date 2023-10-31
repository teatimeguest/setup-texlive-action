const posixPath = await vi.importActual<typeof import('node:path/posix')>(
  'node:path/posix',
);

vi.mock('@actions/http-client');
vi.mock('@actions/glob');
vi.mock('@actions/io');
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
      '#/util/exec',
      '#/util/fs',
    ],
  })
) {
  for (const mod of modules) {
    vi.doMock(mod, async () => {
      return await vi.importActual(
        posixPath.join(
          '##/tests/__mocks__',
          parent,
          mod.replace(/^#/v, ''),
        ),
      );
    });
  }
}
