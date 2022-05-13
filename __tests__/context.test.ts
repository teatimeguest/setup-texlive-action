import * as fs from 'fs/promises';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import 'jest-extended';

import { Version } from '#/texlive';
import { Context } from '#/context';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('~'),
}));
jest.mock('path', () => jest.requireActual('path/posix'));
// eslint-disable-next-line node/prefer-global/process
jest.mock('process', () => globalThis.process);
beforeEach(() => {
  // eslint-disable-next-line node/prefer-global/process
  globalThis.process.env = {
    // default values defined in action.yml
    ['INPUT_CACHE']: 'true',
    ['INPUT_PACKAGES']: '',
    ['INPUT_PACKAGE-FILE']: '',
    ['INPUT_PREFIX']: '',
    ['INPUT_TLCONTRIB']: 'false',
    ['INPUT_VERSION']: 'latest',
  };
});

jest.mocked(cache.isFeatureAvailable).mockReturnValue(true);
const { getInput, getBooleanInput } =
  jest.requireActual<typeof core>('@actions/core');
jest.mocked(core.getInput).mockImplementation(getInput);
jest.mocked(core.getBooleanInput).mockImplementation(getBooleanInput);

jest.mock('#/texlive', () => ({
  Version: jest.requireActual('#/texlive').Version,
}));
jest.mock('#/utility', () => ({
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
}));
jest.unmock('#/context');

describe('Inputs#cache', () => {
  it('defaults to true', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ cache: true }),
    );
  });

  it('is set to false if false is set as input', async () => {
    process.env['INPUT_CACHE'] = 'false';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ cache: false }),
    );
  });

  it('is set to false if cache service is not available', async () => {
    process.env['INPUT_CACHE'] = 'true';
    jest.mocked(cache.isFeatureAvailable).mockReturnValueOnce(false);
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ cache: false }),
    );
    expect(core.warning).toHaveBeenCalledWith(
      'Caching is disabled since cache service is not available',
    );
  });
});

describe('Inputs#packages', () => {
  it('defaults to empty', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ packages: new Set() }),
    );
  });

  it('is set to the set of specified packages by packages input', async () => {
    process.env['INPUT_PACKAGES'] = 'foo bar baz';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ packages: new Set(['bar', 'baz', 'foo']) }),
    );
  });

  it('is set to the set of packages defined by package file', async () => {
    process.env['INPUT_PACKAGE-FILE'] = '<file>';
    jest.mocked(fs.readFile).mockResolvedValueOnce('foo bar baz');
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ packages: new Set(['bar', 'baz', 'foo']) }),
    );
    expect(fs.readFile).toHaveBeenCalledWith('<file>', 'utf8');
  });

  it('contains packages specified by both input and file', async () => {
    process.env['INPUT_PACKAGES'] = 'foo bar baz';
    process.env['INPUT_PACKAGE-FILE'] = '<file>';
    jest.mocked(fs.readFile).mockResolvedValueOnce('qux foo');
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({
        packages: new Set(['bar', 'baz', 'foo', 'qux']),
      }),
    );
  });

  it('does not contain comments or whitespaces', async () => {
    process.env['INPUT_PACKAGES'] =
      '\n  foo\t# this is a comment\nbar  baz \n# \nqux#';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({
        packages: new Set(['bar', 'baz', 'foo', 'qux']),
      }),
    );
  });
});

describe('Inputs#prefix', () => {
  it('is set to the default prefix', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ prefix: '<tmpdir>/setup-texlive' }),
    );
  });

  it('is set to the specified prefix', async () => {
    process.env['INPUT_PREFIX'] = '<prefix>';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ prefix: '<prefix>' }),
    );
  });

  it('uses TEXLIVE_INSTALL_PREFIX if set', async () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ prefix: '<PREFIX>' }),
    );
  });

  it('uses prefix if prefix and TEXLIVE_INSTALL_PREFIX are both set', async () => {
    process.env['INPUT_PREFIX'] = '<prefix>';
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ prefix: '<prefix>' }),
    );
  });
});

describe('Inputs#tlcontrib', () => {
  it('defaults to false', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ tlcontrib: false }),
    );
  });

  it('is set to true if true is set as input', async () => {
    process.env['INPUT_TLCONTRIB'] = 'true';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ tlcontrib: true }),
    );
  });

  it('is set to false if an older version is specified', async () => {
    process.env['INPUT_TLCONTRIB'] = 'true';
    process.env['INPUT_VERSION'] = '2010';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ tlcontrib: false }),
    );
    expect(core.warning).toHaveBeenCalledWith(
      'tlcontrib is ignored for an older version',
    );
  });
});

describe('Inputs#version', () => {
  it('defaults to the latest version', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ version: Version.LATEST }),
    );
  });

  it('is set to the specified version', async () => {
    process.env['INPUT_VERSION'] = '2018';
    await expect(Context.get()).resolves.toHaveProperty(
      'inputs',
      expect.objectContaining({ version: '2018' }),
    );
  });

  it('fails with invalid input', async () => {
    process.env['INPUT_VERSION'] = 'version';
    await expect(Context.get()).rejects.toThrow(
      "version must be specified by year or 'latest'",
    );
  });
});

describe('Outputs#cacheHit', () => {
  it('sets cache-hit to true', async () => {
    await expect(
      Context.get().then(({ outputs }) => {
        outputs.cacheHit();
      }),
    ).toResolve();
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', true);
  });
});

describe('Env', () => {
  it('has some default values', async () => {
    await expect(Context.get()).resolves.toHaveProperty(
      'env',
      expect.objectContaining({
        ['TEXLIVE_INSTALL_ENV_NOCHECK']: '1',
        ['TEXLIVE_INSTALL_NO_WELCOME']: '1',
        ['TEXLIVE_INSTALL_PREFIX']: '<tmpdir>/setup-texlive',
        ['TEXLIVE_INSTALL_TEXMFCONFIG']: `~/.local/texlive/${Version.LATEST}/texmf-config`,
        ['TEXLIVE_INSTALL_TEXMFVAR']: `~/.local/texlive/${Version.LATEST}/texmf-var`,
        ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
      }),
    );
  });

  it('ignores some environment variables', async () => {
    process.env['TEXLIVE_INSTALL_TEXDIR'] = '<texdir>';
    await expect(
      Context.get().then(({ env }) => env),
    ).resolves.not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(process.env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(core.warning).toHaveBeenCalledWith(
      'TEXLIVE_INSTALL_TEXDIR is set, but ignored',
    );
  });

  it('favors user settings over default values', async () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    process.env['NOPERLDOC'] = 'true';
    await expect(Context.get()).resolves.toHaveProperty(
      'env',
      expect.objectContaining({
        ['TEXLIVE_INSTALL_PREFIX']: '<PREFIX>',
        ['NOPERLDOC']: 'true',
      }),
    );
  });
});
