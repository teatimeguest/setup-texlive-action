import { createContext } from 'unctx';

import type { CacheEntryConfig, CacheServiceConfig } from '#/action/cache';

export const { CacheService, DefaultCacheService } = jest.requireActual<
  Awaited<typeof import('#/action/cache')>
>('#/action/cache');

jest.spyOn(DefaultCacheService.prototype, 'restore');
jest.spyOn(DefaultCacheService.prototype, 'update');
jest.spyOn(DefaultCacheService.prototype, 'register');
jest.spyOn(DefaultCacheService.prototype, Symbol.dispose);

const ctx = createContext<InstanceType<typeof CacheService>>();

jest.spyOn(CacheService, 'setup').mockImplementation(
  (_: CacheEntryConfig, config?: CacheServiceConfig) => {
    const service = new DefaultCacheService();
    (service as Writable<typeof service>).enabled = config?.enable ?? true;
    ctx.set(service);
    return service;
  },
);
jest.spyOn(CacheService, 'use');

export const save = jest.fn().mockResolvedValue(undefined);
