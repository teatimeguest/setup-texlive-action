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

jest.unmock('#/action/env');

jest.mock('#/action/inputs', () => {
  return jest.createMockFromModule('#/action/inputs');
});

jest.mock('#/action/outputs', () => {
  const { Outputs } = jest.requireActual('#/action/outputs');
  jest.spyOn(Outputs.prototype, 'emit');
  return { Outputs };
});

jest.mock('#/action/state', () => {
  return jest.createMockFromModule('#/action/state');
});

jest.mock('#/ctan', () => {
  return { pkg: jest.fn().mockResolvedValue({}) };
});

jest.unmock('#/texlive');

jest.unmock('#/texlive/depends-txt');

jest.mock('#/texlive/install-tl', () => {
  const { InstallTL } = jest.createMockFromModule<any>('#/texlive/install-tl');
  InstallTL.acquire.mockImplementation(async () => new InstallTL());
  return { InstallTL };
});

jest.mock('#/texlive/profile');

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
  // eslint-disable-next-line require-yield
  Tlmgr.prototype.list = jest.fn(async function*() {
    return;
  });
  return { Tlmgr };
});

jest.mock('#/texlive/tlmgr/conf');
jest.mock('#/texlive/tlmgr/path');
jest.mock('#/texlive/tlmgr/pinning');
jest.mock('#/texlive/tlmgr/repository');

jest.mock('#/texlive/tlpkg', () => {
  return {
    check: jest.fn(),
    makeLocalSkeleton: jest.fn(),
    // eslint-disable-next-line require-yield
    tlpdb: jest.fn(async function*() {
      return;
    }),
  };
});

jest.mock('#/texlive/version', () => {
  const { Version } = jest.requireActual('#/texlive/version');
  Version.checkLatest = jest.fn().mockResolvedValue(Version.LATEST);
  return { Version };
});

jest.mock('#/texmf', () => jest.requireActual('#/texmf'));

jest.mock('#/utility', () => {
  const { Serializable } = jest.requireActual('#/utility');
  return {
    ...jest.createMockFromModule<object>('#/utility'),
    Serializable,
    extract: jest.fn().mockResolvedValue('<extract>'),
    determine: jest.fn().mockResolvedValue('<determine>'),
    mkdtemp: jest.fn(async function*() {
      yield '<mkdtemp>';
    }),
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  };
});
