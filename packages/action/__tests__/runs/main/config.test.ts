import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { platform } from 'node:os';

import * as core from '@actions/core';
import {
  type InstallTL,
  ReleaseData,
  acquire,
  tlnet,
} from '@setup-texlive-action/texlive';
import mockFs from 'mock-fs';
import { dedent } from 'ts-dedent';

import * as env from '#action/env';
import * as inputs from '#action/inputs';
import { Config } from '#action/runs/main/config';

vi.unmock('node:fs/promises');
vi.unmock('@actions/glob');
vi.unmock('#action/runs/main/config');

it('calls `env.init`', async () => {
  await expect(Config.load()).resolves.not.toThrow();
  expect(env.init).toHaveBeenCalled();
});

it('calls `ReleaseData.setup`', async () => {
  await expect(Config.load()).resolves.not.toThrow();
  expect(ReleaseData.setup).toHaveBeenCalledAfter(vi.mocked(env.init));
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
    vi.mocked(inputs.getPackages).mockReturnValueOnce('foo bar baz');
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo']),
    );
  });

  it('is set to the set of packages defined by `package-file`', async () => {
    vi.mocked(inputs.getPackageFile).mockReturnValueOnce(`
      .github/tl_packages
      **/DEPENDS.txt
    `);
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo', 'package-1', 'quux', 'qux', 'waldo']),
    );
  });

  it('contains packages specified by both input and file', async () => {
    vi.mocked(inputs.getPackageFile).mockReturnValueOnce(
      'bundle/package-1/DEPENDS.txt',
    );
    vi.mocked(inputs.getPackages).mockReturnValueOnce('foo bar baz');
    await expect(Config.load()).resolves.toHaveProperty(
      'packages',
      new Set(['bar', 'baz', 'foo', 'qux']),
    );
  });
});

describe('repository', () => {
  it.each([
    'http://example.com/path/to/tlnet/',
    'https://somewhere.example.com/path/to/tlnet/',
  ])('accepts %s', async (input) => {
    vi.mocked(inputs.getRepository).mockReturnValueOnce(new URL(input));
    vi.mocked(inputs.getVersion).mockReturnValueOnce('latest');
    await expect(Config.load()).resolves.not.toThrow();
  });

  it.each([
    'ftp://example.com/path/to/historic/',
    'rsync://example.com/path/to/historic/',
  ])('does not support the protocol for %s', async (input) => {
    vi.mocked(inputs.getRepository).mockReturnValueOnce(new URL(input));
    await expect(Config.load()).rejects.toThrow(
      'http/https repositories are support',
    );
  });

  it.each([
    '2008',
    '2011',
  ])('does not support versions prior to 2012', async (version) => {
    vi.mocked(inputs.getRepository).mockReturnValueOnce(new URL(MOCK_URL));
    vi.mocked(inputs.getVersion).mockReturnValueOnce(version);
    await expect(Config.load()).rejects.toThrow(
      'only supported with version 2012 or later',
    );
  });

  it('infers version from URL', async () => {
    const repository =
      'https://example.com/path/to/historic/systems/texlive/2019/tlnet-final/';
    vi.mocked(inputs.getRepository).mockReturnValueOnce(new URL(repository));
    await expect(Config.load()).resolves.toHaveProperty('version', '2019');
  });

  it.each([
    'http://example.com/path/to/tlpretest/',
    'https://example.com/path/to/tlnet/',
  ])('checks `TEXLIVE_YYYY(_pretest)` file', async (repository) => {
    const version = '2018';
    vi.mocked(inputs.getRepository).mockReturnValueOnce(new URL(repository));
    vi.mocked(acquire).mockResolvedValueOnce({ version } as InstallTL);
    await expect(Config.load()).resolves.toHaveProperty('version', version);
    expect(tlnet.checkVersionFile).toHaveBeenCalledBefore(vi.mocked(acquire));
  });
});

describe('tlcontrib', () => {
  it('is set to false for older versions', async () => {
    vi.mocked(inputs.getTlcontrib).mockReturnValueOnce(true);
    vi.mocked(inputs.getVersion).mockReturnValueOnce('2020');
    await expect(Config.load()).resolves.toHaveProperty('tlcontrib', false);
    expect(core.warning).toHaveBeenCalledOnce();
    expect(vi.mocked(core.warning).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      '"TLContrib cannot be used with an older version of TeX Live"',
    );
  });
});

describe('updateAllPackages', () => {
  it('is set to false for older versions', async () => {
    vi.mocked(inputs.getUpdateAllPackages).mockReturnValueOnce(true);
    vi.mocked(inputs.getVersion).mockReturnValueOnce('2015');
    await expect(Config.load()).resolves.toHaveProperty(
      'updateAllPackages',
      false,
    );
    expect(core.info).toHaveBeenCalledOnce();
    expect(vi.mocked(core.info).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      '"`update-all-packages` is ignored for older versions"',
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
    vi.mocked(inputs.getVersion).mockReturnValueOnce('2018');
    await expect(Config.load()).resolves.toHaveProperty('version', '2018');
  });

  it('permits the next version', async () => {
    vi.mocked(inputs.getVersion).mockReturnValueOnce(
      `${Number.parseInt(LATEST_VERSION, 10) + 1}`,
    );
    await expect(Config.load()).resolves.not.toThrow();
  });

  describe.each(['linux', 'win32'] as const)('on %s', (os) => {
    beforeEach(() => {
      vi.mocked(platform).mockReturnValue(os);
    });
    it.each(['2013', '2017', '2022'] as const)('accepts %o', async (spec) => {
      vi.mocked(inputs.getVersion).mockReturnValueOnce(spec);
      await expect(Config.load()).resolves.not.toThrow();
    });
  });

  describe.each(['darwin', 'linux', 'win32'] as const)('on %s', (os) => {
    beforeEach(() => {
      vi.mocked(platform).mockReturnValue(os);
    });

    it.each(['2007', '2029'] as const)('rejects %o', async (spec) => {
      vi.mocked(inputs.getVersion).mockReturnValueOnce(spec);
      await expect(Config.load()).rejects.toThrow(/./v);
    });
  });

  describe('on macOS', () => {
    beforeEach(() => {
      vi.mocked(platform).mockReturnValue('darwin');
    });

    it.each(['2008', '2010', '2012'] as const)('rejects %o', async (spec) => {
      vi.mocked(inputs.getVersion).mockReturnValueOnce(spec);
      await expect(Config.load()).rejects.toThrow(
        'does not work on 64-bit macOS',
      );
    });
  });
});
