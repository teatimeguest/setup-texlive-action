import * as cache from '@actions/cache';

import { restoreCache, saveCache } from '#/action/cache';
import * as log from '#/log';

jest.unmock('#/action/cache');

describe('saveCache', () => {
  it('saves directory to cache', async () => {
    await expect(saveCache('<target>', '<key>')).toResolve();
    expect(cache.saveCache).toHaveBeenCalledOnce();
  });

  it("doesn't itself fail even if cache.saveCache fails", async () => {
    jest.mocked(cache.saveCache).mockRejectedValueOnce(new Error(''));
    await expect(saveCache('<target>', '<key>')).resolves.not.toThrow();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save to cache'),
      expect.any(Object),
    );
  });
});

describe('restoreCache', () => {
  it('returns undefined if cache not found', async () => {
    await expect(
      restoreCache('<target>', '<key>', []),
    )
      .resolves
      .toBeUndefined();
  });

  it("returns 'primary' if primary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key) => key);
    await expect(restoreCache('<target>', '<key>', [])).resolves.toBe(
      '<key>',
    );
  });

  it("returns 'secondary' if secondary cache restored", async () => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementationOnce(async (target, key, keys) => keys?.[0]);
    await expect(
      restoreCache('<target>', '<key>', ['<another key>']),
    )
      .resolves
      .toBe('<another key>');
  });

  it('returns undefined if cache.restoreCache fails', async () => {
    jest.mocked(cache.restoreCache).mockRejectedValueOnce(new Error(''));
    await expect(
      restoreCache('<target>', '<key>', []),
    )
      .resolves
      .toBeUndefined();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to restore cache'),
      expect.any(Object),
    );
  });
});
