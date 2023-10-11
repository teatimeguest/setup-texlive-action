import * as cache from '@actions/cache';
import * as core from '@actions/core';

import {
  ActionsCacheService,
  CacheService,
  DefaultCacheService,
  save,
} from '#/action/cache';

jest.unmock('#/action/cache');
jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn().mockReturnValue('<random_string>'),
}));

const entry = {
  TEXDIR: '<TEXDIR>',
  version: LATEST_VERSION,
  packages: new Set<string>(),
} as const;

describe('CacheService.setup', () => {
  beforeEach(() => {
    jest.mocked(cache.isFeatureAvailable).mockReturnValue(true);
  });

  it.each([
    undefined,
    { enable: true },
  ])('is enabled', (config) => {
    const service = CacheService.setup(entry, config);
    expect(service).toBeInstanceOf(ActionsCacheService);
    expect(service).toHaveProperty('enabled', true);
    expect(service).toHaveProperty('disabled', false);
  });

  it('is disabled', () => {
    const service = CacheService.setup(entry, { enable: false });
    expect(service).toBeInstanceOf(DefaultCacheService);
    expect(service).toHaveProperty('enabled', false);
    expect(service).toHaveProperty('disabled', true);
  });

  it.each([
    undefined,
    { enable: true },
    { enable: false },
  ])('is disabled if cache feature not available', (config) => {
    jest.mocked(cache.isFeatureAvailable).mockReturnValue(false);
    expect(CacheService.setup(entry, config)).toHaveProperty('enabled', false);
  });
});

describe('DefaultCacheService', () => {
  const service = new DefaultCacheService();

  it('does nothing', async () => {
    await expect(service.restore()).toResolve();
    expect(cache.restoreCache).not.toHaveBeenCalled();
  });

  it('sets `cache-hit` to `false`', () => {
    expect(() => service[Symbol.dispose]()).not.toThrow();
    expect(core.setOutput).toHaveBeenCalledWith('cache-hit', false);
  });
});

describe('ActionsCacheService', () => {
  const cacheTypes = [
    'unique',
    'oldunique',
    'primary',
    'oldprimary',
    'secondary',
    'oldsecondary',
    'none',
    'fail',
  ] as const;

  const restore: Record<
    typeof cacheTypes[number],
    typeof cache.restoreCache
  > = {
    unique: async (_, uniqueKey) => uniqueKey,
    oldunique: async (_, __, restoreKeys) => {
      return `${restoreKeys?.[0]}-<random_string>}`;
    },
    primary: async (_, __, restoreKeys) => restoreKeys?.[0],
    oldprimary: async (_, __, restoreKeys) => restoreKeys?.[1],
    secondary: async (_, __, restoreKeys) => restoreKeys?.[2],
    oldsecondary: async (_, __, restoreKeys) => restoreKeys?.[3],
    none: async () => undefined,
    fail: async () => {
      throw new Error();
    },
  };

  describe('restore', () => {
    it.each([
      new Set<string>(),
      new Set(['foo', 'bar', 'baz']),
    ])('restores cache', async (packages) => {
      await expect(new ActionsCacheService({ ...entry, packages }).restore())
        .toResolve();
      expect(cache.restoreCache).toHaveBeenCalledOnce();
      expect(jest.mocked(cache.restoreCache).mock.lastCall).toMatchSnapshot();
    });

    it('never throws', async () => {
      jest.mocked(cache.restoreCache).mockImplementationOnce(restore.fail);
      await expect(new ActionsCacheService(entry).restore()).toResolve();
      expect(core.warning).toHaveBeenCalledOnce();
      expect(jest.mocked(core.warning).mock.lastCall?.[0])
        .toMatchInlineSnapshot(`"Failed to restore cache: Error"`);
    });
  });

  describe.each(
    [
      [true, ['unique', 'oldunique', 'primary', 'oldprimary']],
      [false, ['secondary', 'oldsecondary', 'none', 'fail']],
    ] as const,
  )('hit', (value, types) => {
    it.each(types)(`is set to ${value} (%p)`, async (type) => {
      jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
      const service = new ActionsCacheService(entry);
      await expect(service.restore()).toResolve();
      expect(service).toHaveProperty('hit', value);
    });
  });

  describe.each(
    [
      [true, [
        'unique',
        'oldunique',
        'primary',
        'oldprimary',
        'secondary',
        'oldsecondary',
      ]],
      [false, ['none', 'fail']],
    ] as const,
  )('restored', (value, types) => {
    it.each(types)(`is set to ${value} (%p)`, async (type) => {
      jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
      const service = new ActionsCacheService(entry);
      await expect(service.restore()).toResolve();
      expect(service).toHaveProperty('restored', value);
    });
  });

  describe('@@dispose', () => {
    const run = async () => {
      const service = new ActionsCacheService(entry);
      await service.restore();
      service.register();
      service[Symbol.dispose]();
    };

    it.each(
      [
        'oldunique',
        'oldprimary',
        'secondary',
        'oldsecondary',
        'none',
        'fail',
      ] as const,
    )('sets `target` (%p)', async (type) => {
      jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
      await expect(run()).toResolve();
      expect(core.saveState).toHaveBeenCalledOnce();
      expect(jest.mocked(core.saveState).mock.lastCall).toMatchSnapshot();
    });

    it.each(
      ['unique', 'primary'] as const,
    )('does not set `target` (%p)', async (type) => {
      jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
      await expect(run()).toResolve();
      expect(core.saveState).toHaveBeenCalledOnce();
      expect(jest.mocked(core.saveState).mock.lastCall).toMatchSnapshot();
    });

    it.each(cacheTypes)(
      'sets `target` if `SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE` is set (%p)',
      async (type) => {
        process.env['SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE'] = '1';
        jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
        await expect(run()).toResolve();
        expect(core.saveState).toHaveBeenCalledOnce();
      },
    );

    it.each(cacheTypes)(
      'sets `target` if `SETUP_TEXLIVE_FORCE_UPDATE_CACHE` is set (%p)',
      async (type) => {
        process.env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = '1';
        jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
        await expect(run()).toResolve();
        expect(core.saveState).toHaveBeenCalledOnce();
        expect(core.notice).toHaveBeenCalledOnce();
      },
    );

    describe('prefer `SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE`', () => {
      beforeEach(() => {
        jest.mocked(cache.restoreCache).mockImplementationOnce(restore.primary);
      });

      it('updates cache', async () => {
        process.env['SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE'] = '1';
        process.env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = '0';
        await expect(run()).toResolve();
        expect(core.saveState).toHaveBeenCalledOnce();
        expect(jest.mocked(core.saveState).mock.lastCall?.[1])
          .toHaveProperty('target');
        expect(core.notice).not.toHaveBeenCalledOnce();
      });

      it('does not update cache', async () => {
        process.env['SETUP_TEXLIVE_ACTION_FORCE_UPDATE_CACHE'] = '0';
        process.env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = '1';
        await expect(run()).toResolve();
        expect(core.saveState).toHaveBeenCalledOnce();
        expect(jest.mocked(core.saveState).mock.lastCall?.[1])
          .not
          .toHaveProperty('target');
        expect(core.notice).not.toHaveBeenCalledOnce();
      });
    });

    describe.each(
      [
        [true, [
          'unique',
          'oldunique',
          'primary',
          'oldprimary',
          'secondary',
          'oldsecondary',
        ]],
        [false, ['none', 'fail']],
      ] as const,
    )('sets `cache-hit` to `%p`', (value, types) => {
      it.each(types)('%p', async (type) => {
        jest.mocked(cache.restoreCache).mockImplementationOnce(restore[type]);
        await expect(run()).toResolve();
        expect(core.setOutput).toHaveBeenCalledWith('cache-hit', value);
      });
    });
  });
});

describe('save', () => {
  it('does nothing if state is not saved', async () => {
    await expect(save()).toResolve();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });

  it('saves `target` as cache', async () => {
    jest.mocked(core.getState).mockReturnValueOnce(
      JSON.stringify({ target: '<TEXDIR>', key: '<key>' }),
    );
    await expect(save()).toResolve();
    expect(cache.saveCache).toHaveBeenCalled();
  });

  it('does nothing if `target` is not set', async () => {
    jest.mocked(core.getState).mockReturnValueOnce(
      JSON.stringify({ key: '<key>' }),
    );
    await expect(save()).toResolve();
    expect(cache.saveCache).not.toHaveBeenCalled();
  });

  it('never throws', async () => {
    jest.mocked(cache.saveCache).mockImplementationOnce(async () => {
      throw new Error();
    });
    jest.mocked(core.getState).mockReturnValueOnce(
      JSON.stringify({ target: '<TEXDIR>', key: '<key>' }),
    );
    await expect(save()).toResolve();
    expect(core.warning).toHaveBeenCalledOnce();
    expect(jest.mocked(core.warning).mock.lastCall?.[0]).toMatchInlineSnapshot(
      `"Failed to save to cache: Error"`,
    );
  });

  it('checks the return value of saveCache', async () => {
    jest.mocked(cache.saveCache).mockResolvedValueOnce(-1);
    jest.mocked(core.getState).mockReturnValueOnce(
      JSON.stringify({ target: '<TEXDIR>', key: '<key>' }),
    );
    await expect(save()).toResolve();
    expect(core.info).not.toHaveBeenCalledWith(
      expect.stringContaining('saved with cache key:'),
    );
  });
});
