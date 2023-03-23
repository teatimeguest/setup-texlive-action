import { platform } from 'node:os';

import * as ctan from '#/ctan';
import { Version } from '#/texlive/version';

jest.unmock('#/texlive/version');

describe('constructor', () => {
  it.each(['2008', '2013', '2022', 'latest'])('accepts %p', (spec) => {
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
