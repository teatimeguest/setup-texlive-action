import 'jest-extended';
import 'jest-extended/all';
import 'reflect-metadata';

jest.mock('node:fs/promises', () => {
  return {
    readFile: jest.fn().mockResolvedValue('<readFile>'),
    readdir: jest.fn().mockResolvedValue(['<readdir>']),
    writeFile: jest.fn(),
  };
});

jest.mock('node:os', () => {
  return {
    arch: jest.fn().mockReturnValue('<arch>'),
    homedir: jest.fn().mockReturnValue('~'),
    platform: jest.fn().mockReturnValue('linux'),
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  };
});

jest.mock('node:path', () => {
  const os = jest.requireMock('node:os');
  const { posix, win32 } = jest.requireActual('node:path');
  const getPath = () => os.platform() === 'win32' ? win32 : posix;
  return {
    basename: jest.fn((path, ext) => getPath().basename(path, ext)),
    join: jest.fn((...segments) => getPath().join(...segments)),
    normalize: jest.fn((path) => getPath().normalize(path)),
    posix,
    win32,
  };
});

jest.mock('node:process', () => {
  return { env: {} };
});

jest.mock('@actions/cache', () => {
  return {
    ...jest.createMockFromModule<object>('@actions/cache'),
    isFeatureAvailable: jest.fn().mockReturnValue(true),
  };
});

jest.mock('@actions/core', () => {
  return {
    ...jest.createMockFromModule<object>('@actions/core'),
    getInput: jest.fn().mockReturnValue(''),
    getState: jest.fn().mockReturnValue(''),
    group: jest.fn(async (name, fn) => await fn()),
    setFailed: jest.fn((error) => {
      throw new Error(`${error}`);
    }),
  };
});

jest.mock('@actions/exec', () => {
  return {
    exec: jest.fn(),
    getExecOutput: jest.fn().mockResolvedValue({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }),
  };
});

jest.mock('@actions/tool-cache', () => {
  return {
    ...jest.createMockFromModule<object>('@actions/tool-cache'),
    downloadTool: jest.fn().mockResolvedValue('<downloadTool>'),
    find: jest.fn().mockReturnValue(''),
  };
});

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

jest.mock('#/action/env', () => ({ init: jest.fn() }));

jest.mock('#/action/inputs', () => {
  return jest.createMockFromModule('#/action/inputs');
});

jest.mock('#/ctan', () => {
  return { pkg: jest.fn().mockResolvedValue({}) };
});

jest.unmock('#/texlive');
jest.unmock('#/texlive/depends-txt');
jest.unmock('#/texlive/tlnet');

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
