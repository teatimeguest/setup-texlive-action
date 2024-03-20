import { describe, expect, it, vi } from 'vitest';

import * as fs from 'node:fs/promises';
import * as os from 'node:os';

import stderr from '@setup-texlive-action/fixtures/tlpkg-check_file_and_remove.stderr';

import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';

vi.unmock('#/texlive/tlpkg/patch');

describe('check', () => {
  it('detects forcible removal of packages', async () => {
    const output = { exitCode: 0, stderr, stdout: '' };
    const result = (async () => {
      tlpkg.TlpdbError.checkPackageChecksumMismatch(output);
    })();
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `[TlpdbError: Checksums of some packages did not match]`,
    );
    await expect(result).rejects.toMatchObject({
      packages: ['babel'],
    });
  });
});

describe('patch', () => {
  const directory = '<TEXDIR>';

  it.each<[NodeJS.Platform, Version]>([
    ['linux', `2009`],
    ['linux', `2010`],
    ['win32', `2009`],
    ['win32', `2010`],
  ])(
    'applies a patch for tlpkg/TeXLive/TLWinGoo.pm on (%s %s)',
    async (platform, version) => {
      vi.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ directory, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLWinGoo.pm'),
        'utf8',
      );
    },
  );

  it('applies a patch for tlpkg/tlperl/lib/Encode/Alias.pm', async () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    await expect(tlpkg.patch({ directory, version: `2015` })).toResolve();
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Alias.pm'),
      'utf8',
    );
  });

  it.each<[NodeJS.Platform, Version]>([
    ['win32', `2008`],
    ['win32', `2011`],
    ['win32', `2014`],
    ['win32', `2017`],
    ['darwin', `2017`],
    ['darwin', `2018`],
    ['darwin', `2019`],
  ])(
    'applies a patch tlpkg/TeXLive/TLUtils.pm (%s %s)',
    async (platform, version) => {
      vi.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ directory, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLUtils.pm'),
        'utf8',
      );
    },
  );
});
