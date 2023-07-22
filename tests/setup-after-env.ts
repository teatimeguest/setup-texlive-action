import type {} from 'jest-extended';
import 'jest-extended/all';

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

jest.mock('@actions/http-client');
jest.mock('@actions/io');

jest.mock('#/action/env');
jest.mock('#/action/inputs');
jest.mock('#/action/outputs');
jest.mock('#/log');
jest.mock('#/texlive/install-tl/cli');
jest.mock('#/texlive/tlmgr/actions/install');
jest.mock('#/texlive/tlmgr/actions/path');
jest.mock('#/texlive/tlmgr/actions/pinning');
jest.mock('#/texlive/tlmgr/actions/repository');
jest.mock('#/texlive/tlmgr/actions/update');
jest.mock('#/texlive/tlmgr/actions/version');
jest.mock('#/texlive/tlpkg/patch');
jest.mock('#/texlive/tlpkg/util');
jest.mock('#/texlive/version/validate');
jest.mock('#/util/actions');
jest.mock('#/util/http');

for (
  const mod of [
    '#/action/cache',
    '#/ctan/api',
    '#/ctan/mirrors',
    '#/tex/kpse',
    '#/texlive/install-tl/profile',
    '#/texlive/tlmgr/actions/conf',
    '#/texlive/tlmgr/actions/list',
    '#/texlive/tlmgr/internals',
    '#/texlive/tlnet',
    '#/texlive/version/latest',
    '#/util/exec',
    '#/util/fs',
  ]
) {
  jest.mock(mod, () => jest.requireActual(`./__mocks__/${mod}`));
}
