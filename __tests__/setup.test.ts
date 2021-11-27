import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as setup from '#/setup';
import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

const env = { ...process.env };

let context: {
  inputs: {
    cache: boolean;
    packages: string;
    prefix: string;
    version: string;
  };
  state: {
    post: string;
    key: string;
  };
};

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
jest.spyOn(core, 'getBooleanInput').mockImplementation((name) => {
  if (name === 'cache') {
    return context.inputs.cache;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'getInput').mockImplementation((name) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (context.inputs as any)[name];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'getState').mockImplementation((name) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (context.state as any)[name];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'saveState').mockImplementation();
jest.spyOn(core, 'setOutput').mockImplementation();
jest.spyOn(tl, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'install').mockImplementation();
jest.spyOn(tl.Manager.prototype, 'pathAdd').mockImplementation();

beforeEach(() => {
  console.log('::stop-commands::stoptoken');

  process.env = { ...env };
  process.env['GITHUB_PATH'] = '';
  process.env['ACTIONS_CACHE_URL'] = random();

  context = {
    inputs: {
      cache: true,
      packages: '',
      prefix: '',
      version: 'latest',
    },
    state: {
      post: '',
      key: '',
    },
  };

  (os.platform as jest.Mock).mockReturnValue('linux');
  (path.join as jest.Mock).mockImplementation(path.posix.join);
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  console.log('::stoptoken::');
}, 100000);

describe('setup', () => {
  it('sets up TeX Live by the default settings on Linux', async () => {
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).toBeCalledWith('2021', '/tmp/setup-texlive', 'linux');
    expect(tl.Manager.prototype.install).toBeCalledWith([]);
    expect(core.saveState).toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', false);
  });

  it('sets up TeX Live by the default settings on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (path.join as jest.Mock).mockImplementation(path.win32.join);
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).toBeCalledWith(
      '2021',
      'C:\\TEMP\\setup-texlive',
      'win32',
    );
    expect(tl.Manager.prototype.install).toBeCalledWith([]);
    expect(core.saveState).toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', false);
  });

  it('sets up TeX Live by the default settings on macOS', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).toBeCalledWith('2021', '/tmp/setup-texlive', 'darwin');
    expect(tl.Manager.prototype.install).toBeCalledWith([]);
    expect(core.saveState).toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', false);
  });

  it('sets up TeX Live with custom settings', async () => {
    context.inputs.cache = false;
    context.inputs.packages = ' foo bar\n   baz';
    context.inputs.prefix = '/usr/local/texlive';
    context.inputs.version = '2008';
    await setup.run();
    expect(cache.restoreCache).not.toBeCalled();
    expect(tl.install).toBeCalledWith('2008', '/usr/local/texlive', 'linux');
    expect(tl.Manager.prototype.install).toBeCalledWith(['bar', 'baz', 'foo']);
    expect(core.saveState).not.toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', false);
  });

  it('sets up TeX Live with a system cache', async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
    );
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).not.toBeCalled();
    expect(tl.Manager.prototype.install).toBeCalled();
    expect(core.saveState).toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', true);
  });

  it('sets up TeX Live with a full cache', async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(
      async (paths, primaryKey) => primaryKey,
    );
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).not.toBeCalled();
    expect(tl.Manager.prototype.install).not.toBeCalled();
    expect(core.saveState).not.toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', true);
  });

  it('continues setup even if `cache.restoreCache` throws an exception', async () => {
    (cache.restoreCache as jest.Mock).mockImplementationOnce(async () => {
      throw new Error('oops');
    });
    await setup.run();
    expect(cache.restoreCache).toBeCalled();
    expect(tl.install).toBeCalled();
    expect(tl.Manager.prototype.install).toBeCalled();
    expect(core.saveState).toBeCalledWith('key', expect.anything());
    expect(core.saveState).toBeCalledWith('post', true);
    expect(core.setOutput).toBeCalledWith('cache-hit', false);
  });

  it('disables caching if proper environment variables are not set', async () => {
    process.env['ACTIONS_CACHE_URL'] = undefined;
    process.env['ACTIONS_RUNTIME_URL'] = undefined;
    await setup.run();
    expect(cache.restoreCache).not.toBeCalled();
    expect(core.saveState).not.toBeCalledWith('key', expect.anything());
  });

  it.each(['1995', '2022', 'version'])(
    'fails with the invalid version input',
    async (version) => {
      context.inputs.version = version;
      await expect(setup.run()).rejects.toThrow(
        "`version` must be specified by year or 'latest'",
      );
    },
  );
});

describe('saveCache', () => {
  beforeEach(() => {
    context.state.post = 'true';
  });

  it('saves `TEXDIR` if `key` is set', async () => {
    context.state.key = random();
    await setup.run();
    expect(cache.saveCache).toBeCalledWith(
      expect.arrayContaining([]),
      context.state.key,
    );
  });

  it('does nothing if `key` is not set', async () => {
    await setup.run();
    expect(cache.saveCache).not.toBeCalled();
  });
});
