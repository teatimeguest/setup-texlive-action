import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';

import * as context from '#/context';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

const env = { ...process.env };

let ctx: {
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
jest.spyOn(core, 'getBooleanInput').mockImplementation((name) => {
  if (name === 'cache') {
    return ctx.inputs.cache;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'getInput').mockImplementation((name) => {
  const value = (ctx.inputs as Record<string, string | boolean>)[name];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'getState').mockImplementation((name) => {
  const value = (ctx.state as Record<string, string | boolean>)[name];
  if (typeof value === 'string') {
    return value;
  }
  throw new Error(`Unexpected argument: ${name}`);
});
jest.spyOn(core, 'info').mockImplementation();
jest.spyOn(core, 'saveState').mockImplementation();
jest.spyOn(core, 'setOutput').mockImplementation();
jest.spyOn(core, 'warning').mockImplementation();

const setToLinux = (): void => {
  (os.platform as jest.Mock).mockReturnValue('linux');
  (path.join as jest.Mock).mockImplementation((...paths: Array<string>) => {
    return path.posix.join(...paths);
  });
};

const setToWindows = (): void => {
  (os.platform as jest.Mock).mockReturnValue('win32');
  (path.join as jest.Mock).mockImplementation((...paths: Array<string>) => {
    return path.win32.join(...paths);
  });
};

beforeEach(() => {
  process.env = { ...env };
  process.env['ACTIONS_CACHE_URL'] = random();
  process.env['GITHUB_PATH'] = undefined;
  process.env['TEXLIVE_INSTALL_PREFIX'] = undefined;

  ctx = {
    // The default values defined in `action.yml`.
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

  setToLinux();
});

describe('getInputs', () => {
  it('returns default values on Linux', () => {
    const inputs = context.getInputs();
    expect(inputs.cache).toBe(true);
    expect(inputs.packages).toStrictEqual([]);
    expect(inputs.prefix).toBe('/tmp/setup-texlive');
    expect(inputs.version).toBe('2021');
  });

  it('returns default values on Windows', () => {
    setToWindows();
    const inputs = context.getInputs();
    expect(inputs.cache).toBe(true);
    expect(inputs.packages).toStrictEqual([]);
    expect(inputs.prefix).toBe('C:\\TEMP\\setup-texlive');
    expect(inputs.version).toBe('2021');
  });

  it('returns custom user inputs on Linux', () => {
    ctx.inputs.cache = false;
    ctx.inputs.packages = 'scheme-basic\ncleveref\nhyperref\n';
    ctx.inputs.prefix = '/usr/local/texlive';
    ctx.inputs.version = '2008';
    const inputs = context.getInputs();
    expect(inputs.cache).toBe(false);
    expect(inputs.packages).toStrictEqual([
      'cleveref',
      'hyperref',
      'scheme-basic',
    ]);
    expect(inputs.prefix).toBe('/usr/local/texlive');
    expect(inputs.version).toBe('2008');
  });

  it('returns custom user inputs on Windows', () => {
    ctx.inputs.cache = false;
    ctx.inputs.packages = '  scheme-basic\ncleveref   hyperref ';
    ctx.inputs.prefix = 'C:\\texlive';
    ctx.inputs.version = '2021';
    const inputs = context.getInputs();
    expect(inputs.cache).toBe(false);
    expect(inputs.packages).toStrictEqual([
      'cleveref',
      'hyperref',
      'scheme-basic',
    ]);
    expect(inputs.prefix).toBe('C:\\texlive');
    expect(inputs.version).toBe('2021');
  });

  it('disables caching if environment variables are not set properly', () => {
    process.env['ACTIONS_CACHE_URL'] = undefined;
    process.env['ACTIONS_RUNTIME_URL'] = undefined;
    expect(context.getInputs().cache).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      'Caching is disabled because neither `ACTIONS_CACHE_URL` nor `ACTIONS_RUNTIME_URL` is defined',
    );
  });

  it('uses `TEXLIVE_INSTALL_PREFIX` if set', () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '/usr/local/texlive';
    expect(context.getInputs().prefix).toBe('/usr/local/texlive');
  });

  it('throws an exception if the version input is invalid', () => {
    ctx.inputs.version = 'version';
    expect(context.getInputs).toThrow(
      "`version` must be specified by year or 'latest'",
    );
  });
});

describe('getKey', () => {
  it('returns `key`', () => {
    ctx.state.key = random();
    expect(context.getKey()).toBe(ctx.state.key);
  });

  it('returns `undefined` if the key is not set', () => {
    ctx.state.key = '';
    expect(context.getKey()).toBeUndefined();
  });
});

describe('setKey', () => {
  it('sets `key`', () => {
    const key = random();
    context.setKey(key);
    expect(core.saveState).toHaveBeenCalledWith('key', key);
  });
});

describe('getPost', () => {
  it('returns `false`', () => {
    expect(context.getPost()).toBe(false);
  });

  it('returns `true`', () => {
    ctx.state.post = 'true';
    expect(context.getPost()).toBe(true);
  });
});

describe('setPost', () => {
  it('sets `post` to `true`', () => {
    context.setPost();
    expect(core.saveState).toHaveBeenCalledWith('post', true);
  });
});

describe('setCacheHit', () => {
  it('sets `cache-hit` to `true`', () => {
    context.setCacheHit();
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', true);
  });
});
