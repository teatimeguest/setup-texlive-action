import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as setup from '#/setup';
import * as tl from '#/texlive';

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
jest.spyOn(cache, 'restoreCache');
jest.spyOn(cache, 'saveCache');
jest.spyOn(core, 'getBooleanInput');
jest.spyOn(core, 'getInput');
jest.spyOn(core, 'getState');
jest.spyOn(core, 'saveState');
jest.spyOn(core, 'setOutput');
jest.spyOn(tl, 'install');
jest.spyOn(tl.Manager.prototype, 'install');
jest.spyOn(tl.Manager.prototype, 'pathAdd');

const env = { ...process.env };

const notIf = (condition: boolean) => {
  return <T>(x: jest.JestMatchers<T>) => (condition ? x : x.not);
};

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

beforeEach(() => {
  console.log('::stop-commands::stoptoken');

  process.env = { ...env };
  process.env['GITHUB_PATH'] = '';
  process.env['ACTIONS_CACHE_URL'] = '<some url>';

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
  (cache.saveCache as jest.Mock).mockImplementation();
  (cache.restoreCache as jest.Mock).mockResolvedValue('');
  (core.getBooleanInput as jest.Mock).mockImplementation((name) => {
    if (name === 'cache') {
      return context.inputs.cache;
    }
    throw new Error(`Unexpected argument: ${name}`);
  });
  (core.getInput as jest.Mock).mockImplementation((name) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (context.inputs as any)[name];
    if (typeof value === 'string') {
      return value;
    }
    throw new Error(`Unexpected argument: ${name}`);
  });
  (core.getState as jest.Mock).mockImplementation((name) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (context.state as any)[name];
    if (typeof value === 'string') {
      return value;
    }
    throw new Error(`Unexpected argument: ${name}`);
  });
  (core.saveState as jest.Mock).mockImplementation();
  (core.setOutput as jest.Mock).mockImplementation();
  (tl.install as jest.Mock).mockImplementation();
  (tl.Manager.prototype.install as jest.Mock).mockImplementation();
  (tl.Manager.prototype.pathAdd as jest.Mock).mockImplementation();
});

afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
});

afterAll(async () => {
  console.log('::stoptoken::');
}, 100000);

describe('setup()', () => {
  describe.each([
    [
      {
        cache: true,
        packages: '',
        prefix: '',
        version: 'latest',
      },
      'linux',
      {
        packages: [],
        prefix: '/tmp/setup-texlive',
        version: '2021',
      },
    ],
    [
      {
        cache: false,
        packages: 'foo bar\n  baz',
        prefix: '/usr/local/texlive',
        version: '2019',
      },
      'darwin',
      {
        packages: ['bar', 'baz', 'foo'],
        prefix: '/usr/local/texlive',
        version: '2019',
      },
    ],
    [
      {
        cache: true,
        packages: '',
        prefix: '',
        version: 'latest',
      },
      'win32',
      {
        packages: [],
        prefix: 'C:\\TEMP\\setup-texlive',
        version: '2021',
      },
    ],
    [
      {
        cache: false,
        packages: 'foo bar\n  baz',
        prefix: 'C:\\texlive',
        version: '2019',
      },
      'win32',
      {
        packages: ['bar', 'baz', 'foo'],
        prefix: 'C:\\texlive',
        version: '2019',
      },
    ],
  ])('with %p on %s', (inputs, platform, data) => {
    beforeEach(() => {
      (os.platform as jest.Mock).mockReturnValue(platform);
      (path.join as jest.Mock).mockImplementation(
        platform === 'win32' ? path.win32.join : path.posix.join,
      );
      context.inputs = inputs;
    });

    test('without cache', async () => {
      await setup.run();

      notIf(inputs.cache)(expect(cache.restoreCache)).toBeCalled();
      expect(tl.install).toBeCalledWith(data.version, data.prefix, platform);
      expect(tl.Manager.prototype.install).toBeCalledWith(data.packages);
      notIf(inputs.cache)(expect(core.saveState)).toBeCalledWith(
        'key',
        expect.anything(),
      );
      expect(core.saveState).toBeCalledWith('post', true);
      expect(core.setOutput).toBeCalledWith('cache-hit', false);
    });

    test('with system cache', async () => {
      (cache.restoreCache as jest.Mock).mockImplementation(
        async (paths, primaryKey, restoreKeys) => restoreKeys?.[0] ?? '',
      );

      await setup.run();

      notIf(inputs.cache)(expect(cache.restoreCache)).toBeCalled();
      notIf(!inputs.cache)(expect(tl.install)).toBeCalled();
      notIf(inputs.cache)(expect(tl.Manager.prototype.pathAdd)).toBeCalled();
      expect(tl.Manager.prototype.install).toBeCalledWith(data.packages);
      notIf(inputs.cache)(expect(core.saveState)).toBeCalledWith(
        'key',
        expect.anything(),
      );
      expect(core.saveState).toBeCalledWith('post', true);
      expect(core.setOutput).toBeCalledWith('cache-hit', inputs.cache);
    });

    test('with full cache', async () => {
      (cache.restoreCache as jest.Mock).mockImplementation(
        async (paths, primaryKey) => primaryKey,
      );

      await setup.run();

      notIf(inputs.cache)(expect(cache.restoreCache)).toBeCalled();
      notIf(!inputs.cache)(expect(tl.install)).toBeCalled();
      notIf(inputs.cache)(expect(tl.Manager.prototype.pathAdd)).toBeCalled();
      notIf(!inputs.cache)(expect(tl.Manager.prototype.install)).toBeCalled();
      expect(core.saveState).not.toBeCalledWith('key', expect.anything());
      expect(core.saveState).toBeCalledWith('post', true);
      expect(core.setOutput).toBeCalledWith('cache-hit', inputs.cache);
    });
  });

  test('caching is disabled neither `ACTIONS_CACHE_URL` nor `ACTIONS_RUNTIME_URL` is set', async () => {
    process.env['ACTIONS_CACHE_URL'] = undefined;
    process.env['ACTIONS_RUNTIME_URL'] = undefined;

    await setup.run();
    expect(cache.restoreCache).not.toBeCalled();
    expect(core.saveState).not.toBeCalledWith('key', expect.anything());
  });

  test.each(['2018', '2022', 'version'])(
    'with invalid version input',
    async (version) => {
      context.inputs.version = version;
      await expect(setup.run()).rejects.toThrow(
        "`version` must be specified by year or 'latest'",
      );
    },
  );
});

describe('saveCache()', () => {
  beforeEach(() => {
    context.state.post = 'true';
  });

  test('with `key', async () => {
    context.state.key = 'setup-texlive-primary-key';
    await setup.run();
    expect(cache.saveCache).toBeCalledWith(
      expect.arrayContaining([]),
      context.state.key,
    );
  });

  test('without `key`', async () => {
    await setup.run();
    expect(cache.saveCache).not.toBeCalled();
  });
});
