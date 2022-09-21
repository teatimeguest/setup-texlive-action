import 'jest-extended';
import 'jest-extended/all';
import 'reflect-metadata';

jest.mock('node:fs/promises', () => {
  return {
    readFile: jest.fn().mockResolvedValue('<readFile>'),
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
  const { getInput, getBooleanInput, getState } = jest.requireActual(
    '@actions/core',
  );
  return {
    ...jest.createMockFromModule<object>('@actions/core'),
    getInput,
    getBooleanInput,
    getState,
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

jest.mock('@actions/glob', () => {
  return {
    create: jest.fn().mockResolvedValue({
      glob: jest
        .fn()
        .mockResolvedValue(['<glob>']),
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

jest.mock('#/install-tl', () => {
  const { InstallTL, Profile } = jest.createMockFromModule<any>('#/install-tl');
  InstallTL.acquire.mockImplementation(async () => new InstallTL());
  return { InstallTL, Profile };
});

jest.mock('#/texlive', () => {
  const { DependsTxt, Version, tlnet } = jest.requireActual('#/texlive');
  const { Tlmgr, ...mocks } = jest.createMockFromModule<any>('#/texlive');
  Tlmgr.prototype = {
    conf: new Tlmgr.Conf(),
    install: jest.fn(),
    path: new Tlmgr.Path(),
    pinning: new Tlmgr.Pinning(),
    repository: new Tlmgr.Repository(),
    update: jest.fn(),
  };
  Version.checkLatest = jest.fn().mockResolvedValue(Version.LATEST);
  return {
    ...mocks,
    Tlmgr,
    tlpkg: { check: jest.fn() },
    DependsTxt,
    Version,
    tlnet,
  };
});

jest.mock('#/utility', () => {
  const { Serializable } = jest.requireActual('#/utility');
  return {
    Serializable,
    determine: jest.fn().mockResolvedValue('<determine>'),
    extract: jest.fn().mockResolvedValue('<extract>'),
    mkdtemp: jest.fn(async function*() {
      yield '<mkdtemp>';
    }),
    restoreCache: jest.fn(),
    saveCache: jest.fn(),
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  };
});
