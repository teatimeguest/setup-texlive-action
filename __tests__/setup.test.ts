import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import { Environment, InstallTL } from '#/install-tl';
import * as setup from '#/setup';
import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

process.env = (() => {
  const {
    GITHUB_PATH,
    TEXLIVE_DOWNLOADER,
    TL_DOWNLOAD_PROGRAM,
    TL_DOWNLOAD_ARGS,
    TEXLIVE_INSTALL_ENV_NOCHECK,
    TEXLIVE_INSTALL_NO_CONTEXT_CACHE,
    TEXLIVE_INSTALL_NO_RESUME,
    TEXLIVE_INSTALL_NO_WELCOME,
    TEXLIVE_INSTALL_PAPER,
    TEXLIVE_INSTALL_TEXMFHOME,
    TEXLIVE_INSTALL_TEXMFCONFIG,
    TEXLIVE_INSTALL_TEXMFVAR,
    NOPERLDOC,
    ...rest
  }: Partial<Record<string, string>> = process.env;
  return rest;
})();

jest.mock('os', () => ({
  arch: jest.requireActual('os').arch,
  homedir: jest.fn(),
  platform: jest.fn(),
}));
(os.homedir as jest.Mock).mockReturnValue(random());
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    join: jest.fn((...paths: Array<string>) => {
      return os.platform() === 'win32'
        ? path.win32.join(...paths)
        : path.posix.join(...paths);
    }),
    posix: actual.posix,
    win32: actual.win32,
  };
});
jest.spyOn(cache, 'restoreCache').mockResolvedValue('');
jest.spyOn(cache, 'saveCache').mockImplementation();
jest.spyOn(core, 'debug').mockImplementation();
jest
  .spyOn(core, 'group')
  .mockImplementation(
    async <T>(name: string, fn: () => Promise<T>): Promise<T> => await fn(),
  );
jest.spyOn(core, 'info').mockImplementation();
jest.spyOn(core, 'warning').mockImplementation();
jest.spyOn(context, 'loadConfig').mockImplementation(async () => ({
  cache: true,
  packages: new Set([]),
  prefix:
    os.platform() === 'win32'
      ? 'C:\\TEMP\\setup-texlive'
      : '/tmp/setup-texlive',
  tlcontrib: false,
  version: '2021',
}));
jest.spyOn(context, 'getKey').mockImplementation();
jest.spyOn(context, 'setKey').mockImplementation();
jest.spyOn(context, 'getPost').mockImplementation();
jest.spyOn(context, 'setPost').mockImplementation();
jest.spyOn(context, 'setCacheHit').mockImplementation();
jest.spyOn(Environment, 'get');
jest
  .spyOn(InstallTL, 'download')
  .mockImplementation(async (version) => new InstallTL(version, random()));
jest.spyOn(InstallTL.prototype, 'run').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'conf', 'get').mockReturnValue({
  texmf: jest.fn(async (key, value) => {
    return value === undefined ? undefined : random();
  }) as any,
});
jest
  .spyOn(tl.Manager.prototype, 'path', 'get')
  .mockReturnValue({ add: jest.fn() });
jest
  .spyOn(tl.Manager.prototype, 'pinning', 'get')
  .mockReturnValue({ add: jest.fn() });
jest
  .spyOn(tl.Manager.prototype, 'repository', 'get')
  .mockReturnValue({ add: jest.fn() });

describe('setup', () => {
  beforeAll(() => {
    (context.getPost as jest.Mock).mockReturnValueOnce(false);
  });

  it('sets up TeX Live on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.download).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalledWith('/tmp/setup-texlive');
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.download).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalledWith(
      'C:\\TEMP\\setup-texlive',
    );
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live on macOS', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.download).toHaveBeenCalledWith('2021');
    expect(InstallTL.prototype.run).toHaveBeenCalledWith('/tmp/setup-texlive');
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with custom settings', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: false,
      packages: new Set(['cleveref', 'hyperref', 'scheme-basic']),
      prefix: '/usr/local/texlive',
      tlcontrib: false,
      version: '2008',
    });
    await setup.run();
    expect(cache.restoreCache).not.toHaveBeenCalled();
    expect(InstallTL.download).toHaveBeenCalledWith('2008');
    expect(InstallTL.prototype.run).toHaveBeenCalledWith('/usr/local/texlive');
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).toHaveBeenCalledWith(
      new Set(['cleveref', 'hyperref', 'scheme-basic']),
    );
    expect(context.setKey).not.toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with TLContrib', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: new Set([]),
      prefix: '/usr/local/texlive',
      tlcontrib: true,
      version: '2021',
    });
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a system cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: new Set(['scheme-basic']),
      prefix: '/tmp/setup-texlive',
      tlcontrib: false,
      version: '2021',
    });
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.download).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).toHaveBeenCalledWith(
      new Set(['scheme-basic']),
    );
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a full cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.loadConfig as jest.Mock).mockResolvedValueOnce({
      cache: true,
      packages: ['scheme-basic'],
      prefix: '/tmp/setup-texlive',
      tlcontrib: false,
      version: '2021',
    });
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey) => primaryKey,
    );
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.download).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).not.toHaveBeenCalled();
    expect(context.setCacheHit).toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('continues setup even if `cache.restoreCache` fails', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (cache.restoreCache as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('oops');
    });
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(InstallTL.prototype.run).toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('never sets the variables for a new installation', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await setup.run();
    expect(Environment.get).not.toHaveBeenCalled();
  });

  it('sets the variables appropriately if necessary', async () => {
    (os.homedir as jest.Mock).mockReturnValueOnce('~');
    (os.platform as jest.Mock).mockReturnValue('linux');
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    (tl.Manager.prototype.conf.texmf as jest.Mock)
      .mockResolvedValueOnce('~/.texlive')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('~/.local/texlive/2021/texmf-config')
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('/usr/local/texlive/2021/texmf-var');
    await setup.run();
    expect(tl.Manager.prototype.conf.texmf).toHaveBeenCalledWith(
      'TEXMFHOME',
      '~/texmf',
    );
    expect(tl.Manager.prototype.conf.texmf).not.toHaveBeenCalledWith(
      'TEXMFHCONFIG',
      expect.anything(),
    );
    expect(tl.Manager.prototype.conf.texmf).toHaveBeenCalledWith(
      'TEXMFVAR',
      '~/.local/texlive/2021/texmf-var',
    );
  });
});

describe('saveCache', () => {
  beforeAll(() => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getPost as jest.Mock).mockReturnValue(true);
  });

  it('saves `TEXDIR` if `key` is set', async () => {
    (context.getKey as jest.Mock).mockReturnValueOnce(random());
    await setup.run();
    expect(cache.saveCache).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      expect.anything(),
    );
  });

  it('does nothing if `key` is not set', async () => {
    (context.getKey as jest.Mock).mockReturnValueOnce(undefined);
    await setup.run();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });

  it('does not fail even if `cache.saveCache` fails', async () => {
    (context.getKey as jest.Mock).mockReturnValueOnce(random());
    (cache.saveCache as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('oops');
    });
    await expect(setup.run()).resolves.not.toThrow();
    expect(core.warning).toHaveBeenCalled();
  });
});
