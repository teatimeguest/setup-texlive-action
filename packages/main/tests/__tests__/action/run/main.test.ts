import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from 'node:process';

import { setOutput } from '@actions/core';
import type { DeepWritable } from 'ts-essentials';

import { CacheService } from '#/action/cache';
import { Config } from '#/action/config';
import { main } from '#/action/run/main';
import { installTL } from '#/texlive';
import * as tlmgr from '#/texlive/tlmgr/actions';

vi.unmock('#/action/run/main');

const config = {} as DeepWritable<Config>;
vi.mocked(Config.load).mockResolvedValue(config);

beforeEach(() => {
  config.cache = true;
  config.packages = new Set();
  config.prefix = '<prefix>';
  config.tlcontrib = false;
  config.updateAllPackages = false;
  config.version = LATEST_VERSION;
});

class MockCacheService extends CacheService {
  override enabled = true;
  override hit = false;
  override restored = false;

  override async restore() {
    return this;
  }
  override update() {}
  override register() {}
  override [Symbol.dispose]() {}

  static {
    vi.spyOn(this.prototype, 'restore');
    vi.spyOn(this.prototype, 'update');
    vi.spyOn(this.prototype, 'register');
    vi.spyOn(this.prototype, Symbol.dispose);
  }
}

const cacheTypes = [
  ['primary', 'unique'],
  ['primary', 'primary'],
  ['secondary', 'unique'],
  ['secondary', 'primary'],
] as const;

vi.mocked(CacheService.setup).mockImplementation((_, config) => {
  const service = new MockCacheService();
  service.enabled = config?.enable ?? true;
  return service;
});

const setCacheType = ([type]: typeof cacheTypes[number]) => {
  vi.mocked(CacheService.setup).mockImplementationOnce((_, config) => {
    const service = new MockCacheService();
    service.enabled = config?.enable ?? true;
    service.hit = type === 'primary';
    service.restored = true;
    return service;
  });
};

it('installs TeX Live if cache not found', async () => {
  await expect(main()).toResolve();
  expect(MockCacheService.prototype.restore).toHaveBeenCalled();
  expect(installTL).toHaveBeenCalled();
});

it('does not use cache if input cache is false', async () => {
  config.cache = false;
  await expect(main()).toResolve();
  expect(MockCacheService.prototype.restore).not.toHaveBeenCalled();
});

it.each(cacheTypes)(
  'does not install TeX Live if cache found (%s)',
  async (...kind) => {
    setCacheType(kind);
    await expect(main()).toResolve();
    expect(installTL).not.toHaveBeenCalled();
  },
);

it.each([LATEST_VERSION, '2009', '2014'] as const)(
  'sets version to %o with input %o',
  async (version) => {
    config.version = version;
    await expect(main()).toResolve();
    expect(setOutput).toHaveBeenCalledWith('version', version);
  },
);

it('adds TeX Live to path after installation', async () => {
  await expect(main()).toResolve();
  expect(tlmgr.path.add).toHaveBeenCalledAfter(installTL);
});

it.each(cacheTypes)(
  'adds TeX Live to path after cache restoration (%s)',
  async (...kind) => {
    setCacheType(kind);
    await expect(main()).toResolve();
    expect(tlmgr.path.add).not.toHaveBeenCalledBefore(
      MockCacheService.prototype.restore,
    );
    expect(tlmgr.path.add).toHaveBeenCalled();
  },
);

it.each([[true], [false]])(
  'does not update any TeX packages for new installation',
  async (input) => {
    config.updateAllPackages = input;
    await expect(main()).toResolve();
    expect(tlmgr.update).not.toHaveBeenCalled();
  },
);

it.each(cacheTypes)(
  'updates `tlmgr` when cache restored (%s)',
  async (...kind) => {
    setCacheType(kind);
    await expect(main()).toResolve();
    expect(tlmgr.update).toHaveBeenCalledOnce();
    expect(tlmgr.update).toHaveBeenCalledWith({ self: true });
  },
);

it.each(cacheTypes)(
  'updates all packages if `update-all-packages` is true (%s)',
  async (...kind) => {
    setCacheType(kind);
    config.updateAllPackages = true;
    await expect(main()).toResolve();
    expect(tlmgr.update).toHaveBeenCalledTimes(2);
    expect(tlmgr.update).toHaveBeenCalledWith({
      all: true,
      reinstallForciblyRemoved: true,
    });
  },
);

it.each(cacheTypes)(
  'updates tlmgr even for older versions',
  async (...kind) => {
    setCacheType(kind);
    config.updateAllPackages = true;
    config.version = '2020';
    await expect(main()).toResolve();
    expect(tlmgr.update).toHaveBeenCalledWith(
      expect.objectContaining({ self: true }),
    );
  },
);

it('does nothing about TEXMF for new installation', async () => {
  await expect(main()).toResolve();
  expect(tlmgr.conf.texmf).not.toHaveBeenCalled();
});

it.each(cacheTypes)(
  'may change TEXMF after adding TeX Live to path (%s)',
  async (...kind) => {
    setCacheType(kind);
    await expect(main()).toResolve();
    expect(tlmgr.conf.texmf).not.toHaveBeenCalledBefore(tlmgr.path.add);
  },
);

it.each(cacheTypes)(
  'change old settings if they are not appropriate (%s)',
  async (...kind) => {
    setCacheType(kind);
    vi.mocked(tlmgr.conf.texmf).mockResolvedValue('<old>' as unknown as void);
    await expect(main()).toResolve();
    expect(tlmgr.conf.texmf).toHaveBeenCalledWith(
      'TEXMFHOME',
      expect.anything(),
    );
    vi.mocked(tlmgr.conf.texmf).mockReset();
  },
);

it.each(cacheTypes)(
  'does not change old settings if not necessary (case %s)',
  async (...kind) => {
    setCacheType(kind);
    vi.mocked(tlmgr.conf.texmf).mockResolvedValue(
      '<prefix>/texmf-local' as unknown as void,
    );
    await expect(main()).toResolve();
    expect(tlmgr.conf.texmf).not.toHaveBeenCalledWith(
      'TEXMFHOME',
      expect.anything(),
    );
    vi.mocked(tlmgr.conf.texmf).mockReset();
  },
);

it('does not setup tlcontrib by default', async () => {
  await expect(main()).toResolve();
  expect(tlmgr.repository.add).not.toHaveBeenCalled();
  expect(tlmgr.pinning.add).not.toHaveBeenCalled();
});

it('sets up tlcontrib if input tlcontrib is true', async () => {
  config.tlcontrib = true;
  await expect(main()).toResolve();
  expect(tlmgr.repository.add).not.toHaveBeenCalledBefore(tlmgr.path.add);
  expect(tlmgr.repository.add).toHaveBeenCalledWith(
    expect.anything(),
    'tlcontrib',
  );
  expect(tlmgr.pinning.add).not.toHaveBeenCalledBefore(tlmgr.repository.add);
  expect(tlmgr.pinning.add).toHaveBeenCalledWith('tlcontrib', '*');
});

describe.each([[true], [false]])('%j', (force) => {
  beforeEach(() => {
    env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] = force ? '1' : '0';
  });

  it('does not install any packages by default', async () => {
    await expect(main()).toResolve();
    expect(tlmgr.install).not.toHaveBeenCalled();
  });

  it.each([cacheTypes[0], cacheTypes[1]] as const)(
    'does not install any package if full cache found (%s, %s)',
    async (...kind) => {
      setCacheType(kind);
      config.packages = new Set(['foo', 'bar', 'baz']);
      await expect(main()).toResolve();
      expect(tlmgr.install).not.toHaveBeenCalled();
    },
  );

  it.each([cacheTypes[2], cacheTypes[3]] as const)(
    'installs specified packages if full cache not found (%s)',
    async (...kind) => {
      setCacheType(kind);
      config.packages = new Set(['foo', 'bar', 'baz']);
      await expect(main()).toResolve();
      expect(tlmgr.install).toHaveBeenCalled();
    },
  );
});
