import { platform } from 'node:os';

import * as ctan from '#/ctan';
import * as log from '#/log';
import { latest, validateReleaseYear } from '#/texlive/version';

import { config } from '##/package.json';

jest.unmock('#/texlive/version/latest');
jest.unmock('#/texlive/version/validate');

describe('latest.checkVersion', () => {
  it('returns `2023`', async () => {
    await expect(latest.checkVersion()).resolves.toBe('2023');
  });

  it('throws no exception', async () => {
    jest.mocked(ctan.api.pkg).mockResolvedValueOnce({});
    await expect(latest.checkVersion()).toResolve();
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('Failed to check'),
      expect.anything(),
    );
  });
});

describe('getLatest', () => {
  jest.spyOn(latest, 'checkVersion');

  it('does not usually check for the latest version', async () => {
    await expect(latest.getVersion()).toResolve();
    expect(latest.checkVersion).not.toHaveBeenCalled();
  });

  it('checks for the latest version if needed', async () => {
    jest.spyOn(Temporal.Now, 'instant').mockReturnValueOnce(
      Temporal
        .PlainDateTime
        .from(config.texlive.next.releaseDate)
        .toZonedDateTime('UTC')
        .toInstant()
        .add({ hours: 1 }),
    );
    await expect(latest.getVersion()).toResolve();
    expect(latest.checkVersion).toHaveBeenCalled();
  });
});

describe('isLatest', () => {
  it.each(
    [
      [false, '2008'],
      [false, '2020'],
      [true, LATEST_VERSION],
    ] as const,
  )('returns %p for %p', async (bool, spec) => {
    await expect(latest.isLatest(spec)).resolves.toBe(bool);
  });
});

describe('validateReleaseYear', () => {
  it.each(['2008', '2013', '2022'] as const)('accepts %p', async (spec) => {
    await expect(validateReleaseYear(spec)).toResolve();
  });

  it.each(['2029'] as const)('rejects %p', async (spec) => {
    await expect(validateReleaseYear(spec)).toReject();
  });

  it.each(['2008', '2010', '2012'] as const)(
    'rejects %p on macOS',
    async (spec) => {
      jest.mocked(platform).mockReturnValueOnce('darwin');
      await expect(validateReleaseYear(spec)).rejects.toThrow(
        'does not work on 64-bit macOS',
      );
    },
  );
});
