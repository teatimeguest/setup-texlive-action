import * as fs from 'fs/promises';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import 'jest-extended';

import { Env, Inputs, Outputs, State } from '#/context';
import * as log from '#/log';
import { Version } from '#/texlive';

jest.mock('fs/promises', () => ({ readFile: jest.fn() }));
jest.mock(
  'os',
  () => ({
    homedir: jest.fn().mockReturnValue('~'),
    platform: jest.fn().mockReturnValue('linux'),
  }),
);
jest.mock('path', () => jest.requireActual('path/posix'));
// eslint-disable-next-line node/prefer-global/process
jest.mock('process', () => globalThis.process);
beforeEach(() => {
  // eslint-disable-next-line node/prefer-global/process
  globalThis.process.env = {
    // default values defined in action.yml
    INPUT_CACHE: 'true',
    INPUT_PACKAGES: '',
    'INPUT_PACKAGE-FILE': '',
    INPUT_PREFIX: '',
    INPUT_TLCONTRIB: 'false',
    'INPUT_UPDATE-ALL-PACKAGES': 'false',
    INPUT_VERSION: 'latest',
  };
});

jest.mocked(cache.isFeatureAvailable).mockReturnValue(true);
const { getInput, getBooleanInput, getState } = jest.requireActual<typeof core>(
  '@actions/core',
);
jest.mocked(core.getInput).mockImplementation(getInput);
jest.mocked(core.getBooleanInput).mockImplementation(getBooleanInput);
jest.mocked(core.getState).mockImplementation(getState);

jest.mock('#/texlive', () => {
  const actual = jest.requireActual('#/texlive');
  return { DependsTxt: actual.DependsTxt, Version: actual.Version };
});
jest.mock(
  '#/utility',
  () => ({
    Serializable: jest.requireActual('#/utility').Serializable,
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  }),
);
jest.unmock('#/context');

describe('Inputs', () => {
  describe('cache', () => {
    it('defaults to true', () => {
      expect(new Inputs()).toHaveProperty('cache', true);
    });

    it('is set to false if false is set as input', () => {
      process.env['INPUT_CACHE'] = 'false';
      expect(new Inputs()).toHaveProperty('cache', false);
    });

    it('is set to false if cache service is not available', () => {
      process.env['INPUT_CACHE'] = 'true';
      jest.mocked(cache.isFeatureAvailable).mockReturnValueOnce(false);
      expect(new Inputs()).toHaveProperty('cache', false);
      expect(log.warn).toHaveBeenCalledWith(
        'Caching is disabled because cache service is not available',
      );
    });
  });

  describe('packages', () => {
    it('defaults to empty', async () => {
      await expect(new Inputs().packages).resolves.toStrictEqual(new Set());
    });

    it('is set to the set of specified packages by packages input', async () => {
      process.env['INPUT_PACKAGES'] = 'foo bar baz';
      await expect(new Inputs().packages).resolves.toStrictEqual(
        new Set(['bar', 'baz', 'foo']),
      );
    });

    it('is set to the set of packages defined by package file', async () => {
      process.env['INPUT_PACKAGE-FILE'] = '<file>';
      jest.mocked(fs.readFile).mockResolvedValueOnce('foo bar baz');
      await expect(new Inputs().packages).resolves.toStrictEqual(
        new Set(['bar', 'baz', 'foo']),
      );
      expect(fs.readFile).toHaveBeenCalledWith('<file>', 'utf8');
    });

    it('contains packages specified by both input and file', async () => {
      process.env['INPUT_PACKAGES'] = 'foo bar baz';
      process.env['INPUT_PACKAGE-FILE'] = '<file>';
      jest.mocked(fs.readFile).mockResolvedValueOnce('qux foo');
      await expect(new Inputs().packages).resolves.toStrictEqual(
        new Set(['bar', 'baz', 'foo', 'qux']),
      );
    });

    it('does not contain comments or whitespaces', async () => {
      process.env['INPUT_PACKAGES'] =
        '\n  foo\t# this is a comment\nbar  baz \n# \nqux#';
      await expect(new Inputs().packages).resolves.toStrictEqual(
        new Set(['bar', 'baz', 'foo', 'qux']),
      );
    });
  });

  describe('prefix', () => {
    it('is set to the default prefix', () => {
      expect(new Inputs()).toHaveProperty('prefix', '<tmpdir>/setup-texlive');
    });

    it('is set to the specified prefix', () => {
      process.env['INPUT_PREFIX'] = '<prefix>';
      expect(new Inputs()).toHaveProperty('prefix', '<prefix>');
    });

    it('uses TEXLIVE_INSTALL_PREFIX if set', () => {
      process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
      expect(new Inputs()).toHaveProperty('prefix', '<PREFIX>');
    });

    it('uses prefix if prefix and TEXLIVE_INSTALL_PREFIX are both set', () => {
      process.env['INPUT_PREFIX'] = '<prefix>';
      process.env['TEXLIVE_INSTALL_PREFIX'] = '<PREFIX>';
      expect(new Inputs()).toHaveProperty('prefix', '<prefix>');
    });
  });

  describe('tlcontrib', () => {
    it('defaults to false', () => {
      expect(new Inputs()).toHaveProperty('tlcontrib', false);
    });

    it('is set to true if true is set as input', () => {
      process.env['INPUT_TLCONTRIB'] = 'true';
      expect(new Inputs()).toHaveProperty('tlcontrib', true);
    });

    it('is set to false if an older version is specified', () => {
      process.env['INPUT_TLCONTRIB'] = 'true';
      process.env['INPUT_VERSION'] = '2010';
      expect(new Inputs()).toHaveProperty('tlcontrib', false);
      expect(log.warn).toHaveBeenCalledWith(
        '`tlcontrib` is currently ignored for older versions',
      );
    });
  });

  describe('updateAllPackages', () => {
    it('defaults to false', () => {
      expect(new Inputs()).toHaveProperty('updateAllPackages', false);
    });

    it('is set to true if true is set as input', () => {
      process.env['INPUT_UPDATE-ALL-PACKAGES'] = 'true';
      expect(new Inputs()).toHaveProperty('updateAllPackages', true);
    });

    it('is set to false if an older version is specified', () => {
      process.env['INPUT_UPDATE-ALL-PACKAGES'] = 'true';
      process.env['INPUT_VERSION'] = '2016';
      expect(new Inputs()).toHaveProperty('updateAllPackages', false);
      expect(log.info).toHaveBeenCalled();
    });
  });

  describe('version', () => {
    it('defaults to the latest version', () => {
      expect(new Inputs()).toHaveProperty('version', Version.LATEST);
    });

    it('is set to the specified version', () => {
      process.env['INPUT_VERSION'] = '2018';
      expect(new Inputs()).toHaveProperty('version', '2018');
    });

    it('fails with invalid input', () => {
      process.env['INPUT_VERSION'] = 'version';
      expect(() => new Inputs().version).toThrow(
        "Version must be specified by year or 'latest'",
      );
    });
  });
});

describe('Outputs#cache-hit', () => {
  it.each([true, false])('sets cache-hit to %s', (value) => {
    const outputs = new Outputs();
    outputs['cache-hit'] = value;
    outputs.emit();
    expect(core.setOutput).toHaveBeenCalledTimes(1);
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', value);
  });
});

describe('Env', () => {
  it('has some default values', () => {
    expect(Env.get(Version.LATEST)).toMatchObject({
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: '1',
      ['TEXLIVE_INSTALL_NO_WELCOME']: '1',
      ['TEXLIVE_INSTALL_TEXMFCONFIG']:
        `~/.local/texlive/${Version.LATEST}/texmf-config`,
      ['TEXLIVE_INSTALL_TEXMFVAR']:
        `~/.local/texlive/${Version.LATEST}/texmf-var`,
      ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
    });
  });

  it('ignores some environment variables', () => {
    process.env['TEXLIVE_INSTALL_TEXDIR'] = '<texdir>';
    expect(Env.get(Version.LATEST)).not.toHaveProperty(
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
    expect(Env.get(Version.LATEST)).toMatchObject({
      ['TEXLIVE_INSTALL_PREFIX']: '<PREFIX>',
      ['NOPERLDOC']: 'true',
    });
  });
});

describe('State', () => {
  describe('load', () => {
    it('returns null if post not set', () => {
      expect(State.load()).toBeNull();
    });

    it('returns state if set', () => {
      const state = new State();
      state.key = '<key>';
      state.texdir = '<texdir>';
      process.env['STATE_post'] = JSON.stringify(state);
      expect(State.load()).toStrictEqual(state);
    });

    it('returns empty state if set', () => {
      process.env['STATE_post'] = '{}';
      const state = State.load();
      expect(state?.key).toBeUndefined();
      expect(state?.texdir).toBeUndefined();
    });

    it('throws an exception if texdir is not set', () => {
      const state = new State();
      state.key = '<key>';
      process.env['STATE_post'] = JSON.stringify(state);
      // eslint-disable-next-line jest/unbound-method
      expect(State.load).toThrow('Unexpected action state');
    });

    it('throws an exception if key is not set', () => {
      const state = new State();
      state.texdir = '<texdir>';
      process.env['STATE_post'] = JSON.stringify(state);
      // eslint-disable-next-line jest/unbound-method
      expect(State.load).toThrow('Unexpected action state');
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

    it('throws an exception if texdir is not set', () => {
      expect(() => {
        const state = new State();
        state.key = '<key>';
        state.save();
      })
        .toThrow('Unexpected action state');
    });

    it('throws an exception if key is not set', () => {
      expect(() => {
        const state = new State();
        state.texdir = '<texdir>';
        state.save();
      })
        .toThrow('Unexpected action state');
    });
  });
});
