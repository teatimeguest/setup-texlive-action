import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';

import * as context from '#/context';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

const env = (() => {
  const {
    GITHUB_PATH,
    TEXLIVE_INSTALL_PREFIX,
    ...rest
  }: Partial<Record<string, string>> = { ...process.env };
  return rest;
})();

let ctx: {
  inputs: {
    cache: boolean;
    'package-file': string;
    packages: string;
    prefix: string;
    tlcontrib: boolean;
    version: string;
  };
  state: {
    post: string;
    key: string;
  };
};

jest.spyOn(fs, 'readFile').mockImplementation(async (filename) => {
  throw new Error(`Unexpected file access: ${filename}`);
});
jest.mock('os', () => ({
  platform: jest.fn(),
  tmpdir: jest.fn(),
}));
(os.tmpdir as jest.Mock).mockReturnValue(random());
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
jest.spyOn(core, 'getBooleanInput').mockImplementation((name) => {
  const value = (ctx.inputs as Record<string, string | boolean>)[name];
  if (typeof value === 'boolean') {
    return value;
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
jest.spyOn(core, 'warning').mockImplementation();
jest.spyOn(core, 'saveState').mockImplementation();
jest.spyOn(core, 'setOutput').mockImplementation();
jest.spyOn(core, 'warning').mockImplementation();

beforeEach(() => {
  process.env = { ...env };
  process.env['ACTIONS_CACHE_URL'] = random();
  process.env['RUNNER_TEMP'] ??= random();

  ctx = {
    // The default values defined in `action.yml`.
    inputs: {
      cache: true,
      'package-file': '',
      packages: '',
      prefix: '',
      tlcontrib: false,
      version: 'latest',
    },
    state: {
      post: '',
      key: '',
    },
  };
});

describe('loadConfig', () => {
  it('returns default values on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    const inputs = await context.loadConfig();
    expect(inputs.cache).toBe(true);
    expect(inputs.packages).toStrictEqual(new Set([]));
    expect(inputs.prefix).toBe(
      path.join(process.env['RUNNER_TEMP']!, 'setup-texlive'),
    );
    expect(inputs.tlcontrib).toBe(false);
    expect(inputs.version).toBe('2021');
  });

  it('returns default values on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    const inputs = await context.loadConfig();
    expect(inputs.cache).toBe(true);
    expect(inputs.packages).toStrictEqual(new Set([]));
    expect(inputs.prefix).toBe(
      path.join(process.env['RUNNER_TEMP']!, 'setup-texlive'),
    );
    expect(inputs.tlcontrib).toBe(false);
    expect(inputs.version).toBe('2021');
  });

  it('returns custom user inputs on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    ctx.inputs.cache = false;
    ctx.inputs.packages = 'scheme-basic\ncleveref\nhyperref\ncleveref';
    ctx.inputs.prefix = '/usr/local/texlive';
    ctx.inputs.version = '2008';
    const inputs = await context.loadConfig();
    expect(inputs.cache).toBe(false);
    expect(inputs.packages).toStrictEqual(
      new Set(['cleveref', 'hyperref', 'scheme-basic']),
    );
    expect(inputs.prefix).toBe('/usr/local/texlive');
    expect(inputs.tlcontrib).toBe(false);
    expect(inputs.version).toBe('2008');
  });

  it('returns custom user inputs on Windows', async () => {
    (fs.readFile as jest.Mock).mockResolvedValueOnce(
      [
        '# this is a comment     ',
        'latex-bin tex #   this is a coment',
        '  xetex# this is a comment',
        '      #',
        'luatex ',
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('win32');
    ctx.inputs.cache = false;
    ctx.inputs['package-file'] = '.github/tl_packages';
    ctx.inputs.packages = '  luatex\ncleveref   hyperref ';
    ctx.inputs.prefix = 'C:\\texlive';
    ctx.inputs.tlcontrib = true;
    ctx.inputs.version = '2021';
    const inputs = await context.loadConfig();
    expect(inputs.cache).toBe(false);
    expect(inputs.packages).toStrictEqual(
      new Set(['cleveref', 'hyperref', 'latex-bin', 'luatex', 'tex', 'xetex']),
    );
    expect(inputs.prefix).toBe('C:\\texlive');
    expect(inputs.tlcontrib).toBe(true);
    expect(inputs.version).toBe('2021');
  });

  it('disables caching if environment variables are not set properly', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    process.env['ACTIONS_CACHE_URL'] = '';
    process.env['ACTIONS_RUNTIME_URL'] = '';
    expect((await context.loadConfig()).cache).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      'Caching is disabled because neither `ACTIONS_CACHE_URL` nor `ACTIONS_RUNTIME_URL` is defined',
    );
  });

  it('uses `TEXLIVE_INSTALL_PREFIX` if set', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    process.env['TEXLIVE_INSTALL_PREFIX'] = '/usr/local/texlive';
    expect((await context.loadConfig()).prefix).toBe('/usr/local/texlive');
  });

  it('uses `os.tmpdir()` if `RUNNER_TEMP` is not set', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    process.env['TEXLIVE_INSTALL_PREFIX'] = '';
    process.env['RUNNER_TEMP'] = '';
    expect((await context.loadConfig()).prefix).toBe(
      path.join(os.tmpdir(), 'setup-texlive'),
    );
  });

  it('ignores `tlcontrib` if an older version of TeX Live is specified', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    ctx.inputs.tlcontrib = true;
    ctx.inputs.version = '2020';
    expect((await context.loadConfig()).tlcontrib).toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      '`tlcontrib` is ignored since an older version of TeX Live is specified',
    );
  });

  it('throws an exception if the version input is invalid', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    ctx.inputs.version = 'version';
    await expect(context.loadConfig).rejects.toThrow(
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
