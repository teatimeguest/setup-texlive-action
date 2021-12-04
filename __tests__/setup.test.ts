import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import * as setup from '#/setup';
import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

process.env['GITHUB_PATH'] = undefined;

jest.mock('os', () => ({
  arch: jest.requireActual('os').arch,
  platform: jest.fn(),
}));
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
jest.spyOn(context, 'getInputs').mockImplementation(() => ({
  cache: true,
  packages: [],
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
jest.spyOn(tl, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'install').mockImplementation();
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
    expect(tl.install).toHaveBeenCalledWith('2021', '/tmp/setup-texlive');
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
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
    expect(tl.install).toHaveBeenCalledWith('2021', 'C:\\TEMP\\setup-texlive');
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
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
    expect(tl.install).toHaveBeenCalledWith('2021', '/tmp/setup-texlive');
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with custom settings', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getInputs as jest.Mock).mockReturnValueOnce({
      cache: false,
      packages: ['cleveref', 'hyperref', 'scheme-basic'],
      prefix: '/usr/local/texlive',
      tlcontrib: false,
      version: '2008',
    });
    await setup.run();
    expect(cache.restoreCache).not.toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalledWith('2008', '/usr/local/texlive');
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).toHaveBeenCalledWith([
      'cleveref',
      'hyperref',
      'scheme-basic',
    ]);
    expect(context.setKey).not.toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with TLContrib', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getInputs as jest.Mock).mockReturnValueOnce({
      cache: true,
      packages: [],
      prefix: '/usr/local/texlive',
      tlcontrib: true,
      version: '2021',
    });
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a system cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getInputs as jest.Mock).mockReturnValueOnce({
      cache: true,
      packages: ['scheme-basic'],
      prefix: '/tmp/setup-texlive',
      tlcontrib: false,
      version: '2021',
    });
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).toHaveBeenCalledWith(['scheme-basic']);
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
  });

  it('sets up TeX Live with a full cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (context.getInputs as jest.Mock).mockReturnValueOnce({
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
    expect(tl.install).not.toHaveBeenCalled();
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
    expect(tl.install).toHaveBeenCalled();
    expect(tl.Manager.prototype.path.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.pinning.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.repository.add).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setCacheHit).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
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
