import type {} from 'jest-extended';
import 'jest-extended/all';

import '#/globals';

for (
  const mod of [
    'fs/promises',
    'os',
    'path',
    'process',
  ]
) {
  jest.mock(`node:${mod}`, () => jest.requireMock(mod));
}

jest.mock('@actions/glob');
jest.mock('@actions/http-client');
jest.mock('@actions/io');

jest.mock('#/action/config');
jest.mock('#/action/env');
jest.mock('#/texlive/install-tl/cli');
jest.mock('#/texlive/tlmgr/actions/install');
jest.mock('#/texlive/tlmgr/actions/path');
jest.mock('#/texlive/tlmgr/actions/pinning');
jest.mock('#/texlive/tlmgr/actions/repository');
jest.mock('#/texlive/tlmgr/actions/update');
jest.mock('#/texlive/tlmgr/actions/version');
jest.mock('#/texlive/tlpkg/patch');
jest.mock('#/texlive/tlpkg/util');

for (
  const mod of [
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
  ]
) {
  jest.mock(mod, () => jest.requireActual(`##/tests/__mocks__/${mod}`));
}
