import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';

import * as context from '#/context';
import * as setup from '#/setup';
import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

jest.mock('os', () => ({
  arch: jest.requireActual('os').arch,
  platform: jest.fn(),
}));
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    join: jest.fn(),
    posix: actual.posix,
    win32: actual.win32,
  };
});
jest.spyOn(cache, 'restoreCache').mockResolvedValue('');
jest.spyOn(cache, 'saveCache').mockImplementation();
jest.spyOn(context, 'getInputs').mockImplementation();
jest.spyOn(context, 'getKey').mockImplementation();
jest.spyOn(context, 'setKey').mockImplementation();
jest.spyOn(context, 'getPost').mockImplementation();
jest.spyOn(context, 'setPost').mockImplementation();
jest.spyOn(context, 'setCacheHit').mockImplementation();
jest.spyOn(tl, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'pathAdd').mockImplementation();

const setToLinux = (): void => {
  (os.platform as jest.Mock).mockReturnValue('linux');
  (path.join as jest.Mock).mockImplementation((...paths: Array<string>) => {
    return path.posix.join(...paths);
  });
  (context.getInputs as jest.Mock).mockReturnValueOnce({
    cache: true,
    packages: [],
    prefix: '/tmp/setup-texlive',
    version: '2021',
  });
};

const setToMacos = (): void => {
  setToLinux();
  (os.platform as jest.Mock).mockReturnValue('darwin');
};

const setToWindows = (): void => {
  (os.platform as jest.Mock).mockReturnValue('win32');
  (path.join as jest.Mock).mockImplementation((...paths: Array<string>) => {
    return path.win32.join(...paths);
  });
  (context.getInputs as jest.Mock).mockReturnValueOnce({
    cache: true,
    packages: [],
    prefix: 'C:\\TEMP\\setup-texlive',
    version: '2021',
  });
};

beforeEach(() => {
  console.log('::stop-commands::stoptoken');

  process.env['GITHUB_PATH'] = '';
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  console.log('::stoptoken::');
}, 100000);

describe('setup', () => {
  beforeEach(() => {
    (context.getPost as jest.Mock).mockReturnValueOnce(false);
  });

  it('sets up TeX Live on Linux', async () => {
    setToLinux();
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalledWith(
      '2021',
      '/tmp/setup-texlive',
      'linux',
    );
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).not.toHaveBeenCalled();
  });

  it('sets up TeX Live on Windows', async () => {
    setToWindows();
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalledWith(
      '2021',
      'C:\\TEMP\\setup-texlive',
      'win32',
    );
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).not.toHaveBeenCalled();
  });

  it('sets up TeX Live on macOS', async () => {
    setToMacos();
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalledWith(
      '2021',
      '/tmp/setup-texlive',
      'darwin',
    );
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).not.toHaveBeenCalled();
  });

  it('sets up TeX Live with custom settings', async () => {
    setToLinux();
    (context.getInputs as jest.Mock).mockReset().mockReturnValueOnce({
      cache: false,
      packages: ['cleveref', 'hyperref', 'scheme-basic'],
      prefix: '/usr/local/texlive',
      version: '2008',
    });
    await setup.run();
    expect(cache.restoreCache).not.toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalledWith(
      '2008',
      '/usr/local/texlive',
      'linux',
    );
    expect(tl.Manager.prototype.install).toHaveBeenCalledWith([
      'cleveref',
      'hyperref',
      'scheme-basic',
    ]);
    expect(context.setKey).not.toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).not.toHaveBeenCalled();
  });

  it('sets up TeX Live with a system cache', async () => {
    setToLinux();
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).toHaveBeenCalled();
  });

  it('sets up TeX Live with a full cache', async () => {
    setToLinux();
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey) => primaryKey,
    );
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).not.toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).not.toHaveBeenCalled();
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).toHaveBeenCalled();
  });

  it('continues setup even if `cache.restoreCache` throws an exception', async () => {
    setToLinux();
    (cache.restoreCache as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('oops');
    });
    await setup.run();
    expect(cache.restoreCache).toHaveBeenCalled();
    expect(tl.install).toHaveBeenCalled();
    expect(tl.Manager.prototype.install).not.toHaveBeenCalled();
    expect(context.setKey).toHaveBeenCalledWith(expect.anything());
    expect(context.setPost).toHaveBeenCalled();
    expect(context.setCacheHit).not.toHaveBeenCalled();
  });
});

describe('saveCache', () => {
  beforeEach(() => {
    (context.getPost as jest.Mock).mockReturnValue(true);
  });

  it('saves `TEXDIR` if `key` is set', async () => {
    setToLinux();
    (context.getKey as jest.Mock).mockReturnValueOnce(random());
    await setup.run();
    expect(cache.saveCache).toHaveBeenCalledWith(
      expect.arrayContaining([]),
      expect.anything(),
    );
  });

  it('does nothing if `key` is not set', async () => {
    setToLinux();
    (context.getKey as jest.Mock).mockReturnValueOnce(undefined);
    await setup.run();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });
});
