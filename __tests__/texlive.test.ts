import { platform } from 'node:os';

import * as ctan from '#/ctan';
import * as log from '#/log';
import { DependsTxt, Version, tlpkg } from '#/texlive';

jest.unmock('#/texlive');

describe('Version', () => {
  describe('constructor', () => {
    it.each(['2008', '2013', '2021', 'latest'])('accepts %p', (spec) => {
      expect(() => new Version(spec)).not.toThrow();
    });

    it.each(['2007', '2099', '', 'version'])('rejects %p', (spec) => {
      expect(() => new Version(spec)).toThrow('');
    });

    it.each(['2008', '2010', '2012'])('rejects %p on macOS', (spec) => {
      jest.mocked(platform).mockReturnValueOnce('darwin');
      expect(() => new Version(spec)).toThrow('does not work on 64-bit macOS');
    });
  });

  describe('number', () => {
    it.each([
      ['2008', 2008],
      ['2013', 2013],
      ['2018', 2018],
      ['latest', Number.parseInt(Version.LATEST)],
    ])('returns the version number for %p', (spec, n) => {
      expect(new Version(spec)).toHaveProperty('number', n);
    });
  });

  describe('isLatest', () => {
    it.each([
      [false, '2008'],
      [false, '2020'],
      [true, 'latest'],
      [true, Version.LATEST],
    ])('returns %p for %p', (bool, spec) => {
      expect(new Version(spec).isLatest()).toBe(bool);
    });
  });

  describe('checkLatest', () => {
    const latest = Version.LATEST;

    afterEach(() => {
      (Version as any).latest = latest;
    });

    it('checks the latest version', async () => {
      jest.mocked(ctan.pkg).mockResolvedValueOnce({
        version: { number: '2050' },
      });
      await expect(Version.checkLatest()).resolves.toBe('2050');
      expect(Version.LATEST).toBe('2050');
    });
  });

  describe('resolve', () => {
    const { checkLatest } = Version;

    beforeEach(() => {
      Version.checkLatest = jest.fn().mockResolvedValue('2050');
    });

    afterEach(() => {
      Version.checkLatest = checkLatest;
    });

    it.each(['2019', 'latest'])('does not call checkLatest', async (spec) => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2020, 1));
      await expect(Version.resolve(spec)).toResolve();
      expect(Version.checkLatest).not.toHaveBeenCalled();
    });

    it.each(['2012', '2021', 'latest'])('calls checkLatest', async (spec) => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2050, 1));
      await expect(Version.resolve(spec)).toResolve();
      expect(Version.checkLatest).toHaveBeenCalled();
    });

    it('does not fail even if checkLatest fails', async () => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2050, 1));
      jest.mocked(Version.checkLatest).mockRejectedValueOnce(new Error());
      await expect(Version.resolve('latest')).toResolve();
      expect(Version.checkLatest).toHaveBeenCalled();
    });
  });
});

describe('DependsTxt.parse', () => {
  it('parses DEPENDS.txt', () => {
    const manifest = new DependsTxt(
      [
        'foo bar  baz',
        'hard\tqux ',
        ' soft quux# this is a comment',
        '',
        'package corge\t# this is a comment',
        '#',
        '  package  grault  ',
        'soft garply#',
        ' waldo',
        'package\tcorge',
        '  \tbaz',
      ]
        .join('\n'),
    );
    expect(manifest.get('')).toHaveProperty(
      'hard',
      new Set(['foo', 'bar', 'baz', 'qux']),
    );
    expect(manifest.get('')).toHaveProperty('soft', new Set(['quux']));
    expect(manifest.get('corge')).toHaveProperty('hard', new Set(['baz']));
    expect(manifest.get('corge')).not.toHaveProperty('soft');
    expect(manifest.get('grault')).toHaveProperty('hard', new Set(['waldo']));
    expect(manifest.get('grault')).toHaveProperty('soft', new Set(['garply']));
    expect([...manifest]).toHaveLength(3);
  });

  it('tolerates some syntax errors', () => {
    const manifest = new DependsTxt(
      [
        'package', // no argument
        'package#', // no argument
        'hard', // no argument
        'soft#', // no argument, immediately followed by a comment
        'package foo bar', // multiple arguments
        'soft', // no argument, with immediate EOF
      ]
        .join('\n'),
    );
    expect(manifest.get('')).not.toHaveProperty('hard');
    expect(manifest.get('')).not.toHaveProperty('soft');
    expect([...manifest]).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});

describe('tlpkg', () => {
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
});
