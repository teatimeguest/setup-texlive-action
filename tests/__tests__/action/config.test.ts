import { platform } from 'node:os';

import * as core from '@actions/core';
import mockFs from 'mock-fs';
import { dedent } from 'ts-dedent';

import { Config } from '#/action/config';
import * as env from '#/action/env';
import { Inputs } from '#/action/inputs';
import { ReleaseData } from '#/texlive/releases';

jest.unmock('node:fs/promises');
jest.unmock('@actions/glob');
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

describe('packages', () => {
  beforeAll(() => {
    mockFs({
      '.github': {
        tl_packages: dedent`
          foo
          bar
          baz
        `,
        workflows: {
          'ci.yml': dedent`
            name: CI
            on: push
            jobs: ...
          `,
        },
      },
      bundle: {
        'package-1': {
          'package-1.sty': String.raw`\ProvidesPackage{package-1}`,
          'DEPENDS.txt': dedent`
            foo qux
          `,
          'README.md': dedent`
            # package-1

            > A latex package.
          `,
        },
        'package-2': {
          src: {
            'package-2.sty': String.raw`\ProvidesPackage{package-2}`,
          },
          'DEPENDS.txt': dedent`
            quux
            soft package-1
          `,
          'README.md': dedent`
            # package-2

            > Another latex package.
          `,
        },
        'package-3': {
          'package-3.tex': '% package-3.tex',
        },
      },
      'DEPENDS.txt': dedent`
        package package-3
        foo waldo
      `,
    });
  });

  afterAll(mockFs.restore);

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

  it('is set to the set of packages defined by `package-file`', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packageFile: `
        .github/tl_packages
        **/DEPENDS.txt
      `,
    });
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo', 'package-1', 'quux', 'qux', 'waldo']),
    );
  });

  it('contains packages specified by both input and file', async () => {
    jest.mocked(Inputs.load).mockReturnValueOnce({
      ...defaultInputs,
      packageFile: 'bundle/package-1/DEPENDS.txt',
      packages: 'foo bar baz',
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
    expect(core.warning).toHaveBeenCalledOnce();
    expect(jest.mocked(core.warning).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"TLContrib cannot be used with an older version of TeX Live"`,
    );
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
    expect(core.info).toHaveBeenCalledOnce();
    expect(jest.mocked(core.info).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      `"\`update-all-packages\` is ignored for older versions"`,
    );
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
