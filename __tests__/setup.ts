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

jest.mock('#/context', () => {
  const { Outputs } = jest.requireActual('#/context');
  jest.spyOn(Outputs.prototype, 'emit');
  const { Inputs, State } = jest.createMockFromModule<any>('#/context');
  return { Inputs, Outputs, State };
});

jest.mock('#/ctan', () => {
  return { pkg: jest.fn().mockResolvedValue({}) };
});

jest.mock('#/install-tl', () => {
  const { InstallTL, Profile } = jest.createMockFromModule<any>('#/install-tl');
  InstallTL.acquire.mockImplementation(async () => new InstallTL());
  return { InstallTL, Profile };
});

jest.mock('#/texlive', () => {
  const { DependsTxt, Version, tlnet } = jest.requireActual('#/texlive');
  Version.checkLatest = jest.fn().mockResolvedValue(Version.LATEST);
  return {
    ...jest.createMockFromModule<object>('#/texlive'),
    DependsTxt,
    Version,
    tlnet,
  };
});

jest.mock('#/tlmgr', () => {
  class Conf {}
  class Path {}
  class Pinning {}
  class Repository {}
  class Tlmgr {}
  (Conf.prototype as any).texmf = jest.fn();
  (Path.prototype as any).add = jest.fn();
  (Pinning.prototype as any).add = jest.fn();
  (Repository.prototype as any).add = jest.fn();
  (Tlmgr.prototype as any).conf = new Conf();
  (Tlmgr.prototype as any).path = new Path();
  (Tlmgr.prototype as any).pinning = new Pinning();
  (Tlmgr.prototype as any).repository = new Repository();
  (Tlmgr.prototype as any).install = jest.fn();
  (Tlmgr.prototype as any).update = jest.fn();
  // eslint-disable-next-line require-yield
  (Tlmgr.prototype as any).list = jest.fn(async function*() {
    return;
  });
  (Tlmgr.prototype as any).version = jest.fn();
  (Tlmgr as any).Conf = Conf;
  (Tlmgr as any).Path = Path;
  (Tlmgr as any).Pinning = Pinning;
  (Tlmgr as any).Repository = Repository;
  return { Tlmgr };
});

jest.mock('#/tlpkg', () => {
  return {
    check: jest.fn(),
    makeLocalSkeleton: jest.fn(),
    // eslint-disable-next-line require-yield
    tlpdb: jest.fn(async function*() {
      return;
    }),
  };
});

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
