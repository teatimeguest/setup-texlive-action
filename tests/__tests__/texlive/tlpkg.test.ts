import fs from 'node:fs/promises';
import os from 'node:os';

import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';

jest.unmock('#/texlive/tlpkg');

describe('check', () => {
  it('detects forcible removal of packages', () => {
    expect(() =>
      tlpkg.check(
        'TeXLive::TLUtils::check_file_and_remove: '
          + 'checksums differ for /tmp/path/to/foo.tar.xz:\n'
          + 'TeXLive::TLUtils::check_file_and_remove: ...',
      )
    )
      .toThrow('The checksum of package foo did not match.');
  });
});

describe('patch', () => {
  const TEXDIR = '<TEXDIR>';

  it.each<[NodeJS.Platform, Version]>([
    ['linux', `2009`],
    ['linux', `2010`],
    ['win32', `2009`],
    ['win32', `2010`],
  ])(
    'applies a patch for tlpkg/TeXLive/TLWinGoo.pm on (%s %s)',
    async (platform, version) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ TEXDIR, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLWinGoo.pm'),
        'utf8',
      );
    },
  );

  it('applies a patch for tlpkg/tlperl/lib/Encode/Alias.pm', async () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(tlpkg.patch({ TEXDIR, version: `2015` })).toResolve();
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
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ TEXDIR, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLUtils.pm'),
        'utf8',
      );
    },
  );
});
