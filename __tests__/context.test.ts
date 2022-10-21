import fs from 'node:fs/promises';
import process from 'node:process';

import { isFeatureAvailable } from '@actions/cache';
import * as core from '@actions/core';

import { Env, Inputs, Outputs, State } from '#/context';
import * as log from '#/log';
import { Version } from '#/texlive';
import { getInput } from '#/utility';

const v = (spec: unknown) => new Version(`${spec}`);

jest.mock('node:process', () => globalThis.process);

let inputs: {
  cache: boolean;
  packages: string | undefined;
  'package-file': string | undefined;
  prefix: string;
  texdir: string | undefined;
  tlcontrib: boolean;
  'update-all-packages': boolean;
  version: string;
};
beforeEach(() => {
  inputs = {
    cache: true,
    packages: undefined,
    'package-file': undefined,
    prefix: '<prefix>',
    texdir: undefined,
    tlcontrib: false,
    'update-all-packages': false,
    version: 'latest',
  };
});
jest.mocked(getInput).mockImplementation((name: string) => {
  return (inputs as any)[name];
});
jest.unmock('#/context');

describe('Inputs', () => {
  describe('cache', () => {
    it.each([true, false])('is set as input', async (input) => {
      inputs.cache = input;
      await expect(Inputs.load()).resolves.toHaveProperty('cache', input);
    });

    it('is set to false if cache service is not available', async () => {
      jest.mocked(isFeatureAvailable).mockReturnValueOnce(false);
      await expect(Inputs.load()).resolves.toHaveProperty('cache', false);
      expect(log.warn).toHaveBeenCalledWith(
        'Caching is disabled because cache service is not available',
      );
    });
  });

  describe('packages', () => {
    it('defaults to empty', async () => {
      await expect(Inputs.load()).resolves.toHaveProperty(
        'packages',
        new Set(),
      );
    });

    it('is set to the set of specified packages by packages input', async () => {
      inputs.packages = 'foo bar baz';
      await expect(Inputs.load()).resolves.toHaveProperty(
        'packages',
        new Set(['bar', 'baz', 'foo']),
      );
    });

    it('is set to the set of packages defined by package file', async () => {
      inputs['package-file'] = '<package-file>';
      jest.mocked(fs.readFile).mockResolvedValueOnce('foo bar baz');
      await expect(Inputs.load()).resolves.toHaveProperty(
        'packages',
        new Set(['bar', 'baz', 'foo']),
      );
      expect(fs.readFile).toHaveBeenCalledWith('<package-file>', 'utf8');
    });

    it('contains packages specified by both input and file', async () => {
      inputs.packages = 'foo bar baz';
      inputs['package-file'] = '<package-file>';
      jest.mocked(fs.readFile).mockResolvedValueOnce('qux foo');
      await expect(Inputs.load()).resolves.toHaveProperty(
        'packages',
        new Set(['bar', 'baz', 'foo', 'qux']),
      );
    });

    it('does not contain comments or whitespaces', async () => {
      inputs.packages = '\n  foo\t# this is a comment\nbar  baz \n# \nqux#';
      await expect(Inputs.load()).resolves.toHaveProperty(
        'packages',
        new Set(['bar', 'baz', 'foo', 'qux']),
      );
    });
  });

  describe('texmf', () => {
    it('has default values', async () => {
      const { texmf } = await Inputs.load();
      expect(texmf).toHaveProperty('TEX_PREFIX', '<prefix>');
      expect(texmf).toHaveProperty(
        'TEXMFCONFIG',
        `~/.local/texlive/${v`latest`}/texmf-config`,
      );
    });

    it('does not have TEXDIR by default', async () => {
      const { texmf } = await Inputs.load();
      expect(texmf).not.toHaveProperty('TEXDIR');
    });

    it('has TEXDIR as input', async () => {
      inputs.texdir = '<TEXDIR>';
      const { texmf } = await Inputs.load();
      expect(texmf).toHaveProperty('TEXDIR', '<TEXDIR>');
    });
  });

  describe('tlcontrib', () => {
    it.each([true, false])('is set as input', async (input) => {
      inputs.tlcontrib = input;
      await expect(Inputs.load()).resolves.toHaveProperty('tlcontrib', input);
    });

    it('is set to false if an older version is specified', async () => {
      inputs.tlcontrib = true;
      inputs.version = '2020';
      await expect(Inputs.load()).resolves.toHaveProperty('tlcontrib', false);
      expect(log.warn).toHaveBeenCalledWith(
        '`tlcontrib` is currently ignored for older versions',
      );
    });
  });

  describe('updateAllPackages', () => {
    it.each([true, false])('is set as input', async (input) => {
      inputs['update-all-packages'] = input;
      await expect(Inputs.load()).resolves.toHaveProperty(
        'updateAllPackages',
        input,
      );
    });

    it('is set to false if an older version is specified', async () => {
      inputs['update-all-packages'] = true;
      inputs.version = '2015';
      await expect(Inputs.load()).resolves.toHaveProperty(
        'updateAllPackages',
        false,
      );
      expect(log.info).toHaveBeenCalled();
    });
  });

  describe('version', () => {
    it('defaults to the latest version', async () => {
      await expect(Inputs.load()).resolves.toHaveProperty('version', v`latest`);
    });

    it('is set to the specified version', async () => {
      inputs.version = '2018';
      await expect(Inputs.load()).resolves.toHaveProperty('version', v`2018`);
    });

    it('fails with invalid input', async () => {
      inputs.version = '<version>';
      await expect(Inputs.load()).rejects.toThrow('');
    });
  });
});

describe('Outputs#cacheHit', () => {
  it.each([true, false])('sets cache-hit to %s', (value) => {
    const outputs = new Outputs();
    outputs.cacheHit = value;
    outputs.version = v`latest`;
    outputs.emit();
    expect(core.setOutput).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', value);
  });

  it.each([
    ['2017', v`2017`],
    [Version.LATEST, v`latest`],
  ])('sets version to %p', (value, version) => {
    const outputs = new Outputs();
    outputs.version = version;
    outputs.emit();
    expect(core.setOutput).toHaveBeenCalledTimes(2);
    expect(core.setOutput).toHaveBeenCalledWith('version', value);
  });
});

describe('Env', () => {
  it('has some default values', () => {
    expect(Env.load(v`latest`)).toMatchObject({
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
      TEXLIVE_INSTALL_TEXMFCONFIG: `~/.local/texlive/${v`latest`}/texmf-config`,
      TEXLIVE_INSTALL_TEXMFVAR: `~/.local/texlive/${v`latest`}/texmf-var`,
      TEXLIVE_INSTALL_TEXMFHOME: '~/texmf',
    });
  });

  it('ignores some environment variables', () => {
    process.env['TEXLIVE_INSTALL_TEXDIR'] = '<texdir>';
    expect(Env.load(v`latest`)).not.toHaveProperty(
      'TEXLIVE_INSTALL_TEXDIR',
    );
    expect(process.env).not.toHaveProperty('TEXLIVE_INSTALL_TEXDIR');
    expect(log.warn).toHaveBeenCalledWith(
      '`TEXLIVE_INSTALL_TEXDIR` is set, but ignored',
    );
  });

  it('favors user settings over default values', () => {
    process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
    process.env['NOPERLDOC'] = 'true';
    expect(Env.load(v`latest`)).toMatchObject({
      ['TEXLIVE_INSTALL_PREFIX']: '<PREFIX>',
      ['NOPERLDOC']: 'true',
    });
  });
});

describe('State', () => {
  describe('constructor', () => {
    it.each([
      [false, ''],
      [true, '{}'],
      [true, '{ "key": "key" }'],
      [true, '{ "key": "key", "texdir": "texdir" }'],
    ])('sets post to %s (%p)', (value, state) => {
      jest.mocked(core.getState).mockReturnValueOnce(state);
      expect(new State()).toHaveProperty('post', value);
    });

    it('gets state', () => {
      const state = { key: '<key>', texdir: '<texdir>' };
      jest.mocked(core.getState).mockReturnValueOnce(JSON.stringify(state));
      expect(new State()).toMatchObject(state);
    });
  });

  describe('save', () => {
    it('saves state', () => {
      expect(() => {
        const state = new State();
        state.key = '<key>';
        state.texdir = '<texdir>';
        state.save();
      })
        .not
        .toThrow();
      expect(core.saveState).toHaveBeenCalled();
    });

    it('saves empty state', () => {
      expect(() => {
        new State().save();
      })
        .not
        .toThrow();
      expect(core.saveState).toHaveBeenCalled();
    });
  });
});
