import fs from 'node:fs/promises';
import { platform } from 'node:os';

import { Config } from '#/action/config';
import * as env from '#/action/env';
import { Inputs } from '#/action/inputs';
import * as log from '#/log';
import { ReleaseData } from '#/texlive/releases';

jest.unmock('#/action/config');

const defaultInputs = Inputs.load();

it('calls `env.init`', async () => {
  await expect(Config.load()).toResolve();
  expect(env.init).toHaveBeenCalledBefore(jest.mocked(Inputs.load));
});

it('calls `ReleaseData.setup`', async () => {
  await expect(Config.load()).toResolve();
  expect(ReleaseData.setup).toHaveBeenCalledAfter(jest.mocked(env.init));
  expect(ReleaseData.setup).toHaveBeenCalledBefore(jest.mocked(Inputs.load));
});

it('calls `env.setDefaultTexmfUserTrees`', async () => {
  await expect(Config.load()).toResolve();
  expect(env.setDefaultTexmfUserTrees).toHaveBeenCalled();
});

describe('packages', () => {
  it('defaults to empty', async () => {
    await expect(Config.load()).resolves.toHaveProperty('packages', new Set());
  });

  it('is set to the set of specified packages by packages input', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packages: 'foo bar baz',
    });
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo']),
    );
  });

  it('is set to the set of packages defined by package file', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packageFile: '<package-file>',
    });
    jest.mocked(fs.readFile).mockResolvedValueOnce('foo bar baz');
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo']),
    );
    expect(fs.readFile).toHaveBeenCalledWith('<package-file>', 'utf8');
  });

  it('contains packages specified by both input and file', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packageFile: '<package-file>',
      packages: 'foo bar baz',
    });
    jest.mocked(fs.readFile).mockResolvedValueOnce('qux foo');
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo', 'qux']),
    );
  });

  it('does not contain comments or whitespaces', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packages: '\n  foo\t# this is a comment\nbar  baz \n# \nqux#',
    });
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo', 'qux']),
    );
  });
});

describe('tlcontrib', () => {
  it('is set to false for older versions', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      tlcontrib: true,
      version: '2020',
    });
    await expect(Config.load()).resolves.toHaveProperty('tlcontrib', false);
    expect(log.warn).toHaveBeenCalled();
  });
});

describe('updateAllPackages', () => {
  it('is set to false for older versions', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      updateAllPackages: true,
      version: '2015',
    });
    await expect(Config.load()).resolves.toHaveProperty(
      'updateAllPackages',
      false,
    );
    expect(log.info).toHaveBeenCalled();
  });
});

describe('version', () => {
  it('defaults to the latest version', async () => {
    await expect(Config.load()).resolves.toHaveProperty(
      'version',
      LATEST_VERSION,
    );
  });

  it('is set to the specified version', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      version: '2018',
    });
    await expect(Config.load()).resolves.toHaveProperty('version', '2018');
  });

  describe.each(['linux', 'win32'] as const)('on %s', (os) => {
    beforeEach(() => {
      jest.mocked(platform).mockReturnValue(os);
    });
    it.each(['2013', '2017', '2022'] as const)('accepts %p', async (spec) => {
      jest.mocked(Inputs.load).mockReturnValueOnce({
        ...defaultInputs,
        version: spec,
      });
      await expect(Config.load()).toResolve();
    });
  });

  describe.each(['darwin', 'linux', 'win32'] as const)('on %s', (os) => {
    beforeEach(() => {
      jest.mocked(platform).mockReturnValue(os);
    });
    it.each(['2007', '2029'] as const)('rejects %p', async (spec) => {
      jest.mocked(Inputs.load).mockReturnValueOnce({
        ...defaultInputs,
        version: spec,
      });
      await expect(Config.load()).toReject();
    });
  });

  describe('on macOS', () => {
    beforeEach(() => {
      jest.mocked(platform).mockReturnValue('darwin');
    });
    it.each(['2008', '2010', '2012'] as const)('rejects %p', async (spec) => {
      jest.mocked(Inputs.load).mockReturnValueOnce({
        ...defaultInputs,
        version: spec,
      });
      await expect(Config.load()).rejects.toThrow(
        'does not work on 64-bit macOS',
      );
    });
  });
});
