import { vi } from 'vitest';

import { createContext } from 'unctx';

import type { CacheEntryConfig, CacheServiceConfig } from '#/action/cache';

export const { CacheService, DefaultCacheService } = await vi.importActual<
  typeof import('#/action/cache')
>('#/action/cache');

vi.spyOn(DefaultCacheService.prototype, 'restore');
vi.spyOn(DefaultCacheService.prototype, 'update');
vi.spyOn(DefaultCacheService.prototype, 'register');
vi.spyOn(DefaultCacheService.prototype, Symbol.dispose);

const ctx = createContext<InstanceType<typeof CacheService>>();

vi.spyOn(CacheService, 'setup').mockImplementation(
  (_: CacheEntryConfig, config?: CacheServiceConfig) => {
    const service = new DefaultCacheService();
    (service as Writable<typeof service>).enabled = config?.enable ?? true;
    ctx.set(service);
    return service;
  },
);
vi.spyOn(CacheService, 'use');

export const save = vi.fn().mockResolvedValue(undefined);
