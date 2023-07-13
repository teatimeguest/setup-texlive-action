import 'jest-extended';
import 'jest-extended/all';

import '#/globals';

// https://www.rfc-editor.org/rfc/rfc2606.html
const mockUrl = 'https://example.com/';

for (const mod of ['fs/promises', 'os', 'path', 'process']) {
  jest.mock(`node:${mod}`, () => jest.requireMock(mod));
}

jest.mock('#/action/cache', () => {
  class CacheClient {
    async restore(): Promise<void> {}
    update(): void {}
    saveState(): void {}
  }
  CacheClient.prototype.restore = jest.fn().mockResolvedValue({
    hit: false,
    full: false,
    restored: false,
  });
  CacheClient.prototype.update = jest.fn();
  CacheClient.prototype.saveState = jest.fn();
  return { CacheClient, save: jest.fn().mockResolvedValue(undefined) };
});

jest.unmock('#/ctan');

jest.mock('#/ctan/api', () => ({
  pkg: jest.fn().mockResolvedValue({}),
}));

jest.mock('#/ctan/mirrors', () => ({
  resolve: jest.fn().mockResolvedValue(new URL(mockUrl)),
}));

jest.unmock('#/texlive');
jest.unmock('#/texlive/depends-txt');

jest.mock('#/texlive/tlnet', () => ({
  ctan: jest.fn().mockResolvedValue(new URL(mockUrl)),
  contrib: jest.fn().mockResolvedValue(new URL(mockUrl)),
  historic: jest.fn().mockReturnValue(new URL(mockUrl)),
}));

jest.mock('#/texlive/tlmgr', () => {
  const { Conf } = jest.requireMock('#/texlive/tlmgr/conf');
  const { Path } = jest.requireMock('#/texlive/tlmgr/path');
  const { Pinning } = jest.requireMock('#/texlive/tlmgr/pinning');
  const { Repository } = jest.requireMock('#/texlive/tlmgr/repository');
  const { Tlmgr } = jest.createMockFromModule<any>('#/texlive/tlmgr');
  Tlmgr.prototype.conf = new Conf();
  Tlmgr.prototype.path = new Path();
  Tlmgr.prototype.pinning = new Pinning();
  Tlmgr.prototype.repository = new Repository();
  Tlmgr.prototype.list = jest.fn(async function*() {});
  return { Tlmgr };
});

jest.mock('#/texlive/version', () => {
  const { Version } = jest.requireActual('#/texlive/version');
  Version.checkLatest = jest.fn().mockResolvedValue(Version.LATEST);
  return { Version };
});

jest.unmock('#/texmf');

jest.unmock('#/util');

jest.mock('#/util/exec', () => {
  const { ExecError, ExecResult } = jest.requireActual('#/util/exec');
  return {
    ExecError,
    ExecResult,
    exec: jest.fn(async (command, args) => {
      return new ExecResult({
        command,
        args,
        exitCode: 0,
        stderr: '',
        stdout: '',
      });
    }),
  };
});

jest.mock(
  '#/util/fs',
  () => ({
    extract: jest.fn().mockResolvedValue('<extract>'),
    mkdtemp: jest.fn(async function*() {
      yield '<mkdtemp>';
    }),
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
    uniqueChild: jest.fn().mockResolvedValue('<uniqueChild>'),
  }),
);

jest.unmock('#/util/serializable');
