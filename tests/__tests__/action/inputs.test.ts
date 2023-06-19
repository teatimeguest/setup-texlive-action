import fs from 'node:fs/promises';

import { isFeatureAvailable } from '@actions/cache';

import { Inputs } from '#/action/inputs';
import * as log from '#/log';
import type { Version } from '#/texlive/version';
import { getInput } from '#/util';

import { config } from '##/package.json';

const LATEST_VERSION = config.texlive.latest.version as Version;

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
jest.unmock('#/action/inputs');

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
      await expect(Inputs.load()).resolves.toHaveProperty(
        'version',
        LATEST_VERSION,
      );
    });

    it('is set to the specified version', async () => {
      inputs.version = '2018';
      await expect(Inputs.load()).resolves.toHaveProperty('version', '2018');
    });
  });
});
