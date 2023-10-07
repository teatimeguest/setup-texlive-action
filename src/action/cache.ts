import { createHash, randomUUID } from 'node:crypto';
import { arch, platform } from 'node:os';
import { env } from 'node:process';

import {
  ReserveCacheError,
  isFeatureAvailable as isCacheFeatureAvailable,
  restoreCache,
  saveCache,
} from '@actions/cache';
import { getState, saveState, setOutput } from '@actions/core';
import {
  Exclude,
  Expose,
  instanceToPlain,
  plainToInstance,
} from 'class-transformer';
import { createContext } from 'unctx';

import { ID } from '#/action/id';
import * as log from '#/log';
import type { Version } from '#/texlive';

const STATE_NAME = 'CACHE' as const;

export interface CacheEntryConfig {
  readonly TEXDIR: string;
  readonly packages: Iterable<string>;
  readonly version: Version;
}

export interface CacheServiceConfig {
  /** @defaultValue `true` */
  readonly enable?: boolean;
}

export abstract class CacheInfo {
  abstract readonly hit: boolean;
  abstract readonly restored: boolean;
}

export abstract class CacheService extends CacheInfo implements Disposable {
  abstract readonly enabled: boolean;

  abstract restore(): Promise<CacheInfo>;
  abstract update(): void;

  get disabled(): boolean {
    return !this.enabled;
  }

  [Symbol.dispose](): void {
    setOutput('cache-hit', this.restored);
  }
}

export namespace CacheService {
  const ctx = createContext<CacheService>();
  export const { use } = ctx;

  export function setup(
    this: void,
    entry: CacheEntryConfig,
    config?: CacheServiceConfig,
  ): CacheService {
    let service: CacheService | undefined;
    if (config?.enable ?? true) {
      if (isCacheFeatureAvailable()) {
        service = new ActionsCacheService(entry);
      } else {
        log.warn('Caching is disabled as cache service is not available');
      }
    }
    ctx.set(service ??= new DefaultCacheService());
    return service;
  }
}

/** @internal */
export class DefaultCacheService extends CacheService {
  override readonly enabled: boolean = false;
  override readonly hit: boolean = false;
  override readonly restored: boolean = false;

  override async restore(): Promise<CacheInfo> {
    return this;
  }
  override update(): void {}
}

interface CacheEntry {
  readonly target?: string;
  readonly key?: string;
}

/** @internal */
@Exclude()
export class ActionsCacheService extends CacheService implements CacheEntry {
  override readonly enabled: boolean = true;

  @Expose({ groups: ['update'] })
  readonly target: string;

  readonly #keys: CacheKeys;
  #matchedKey: string | undefined;
  #forceUpdate: boolean;

  constructor(entry: CacheEntryConfig) {
    super();
    this.target = entry.TEXDIR;
    this.#keys = new CacheKeys(entry);
    this.#forceUpdate =
      (env[`${ID.SCREAMING_SNAKE_CASE}_FORCE_UPDATE_CACHE`] ?? '0') !== '0';
  }

  override async restore(): Promise<CacheInfo> {
    try {
      this.#matchedKey = await restoreCache(
        [this.target],
        this.#keys.uniqueKey,
        this.#keys.restoreKeys,
      );
      log.info(
        this.#matchedKey !== undefined
          ? `${this.target} restored from cache with key: ${this.#matchedKey}`
          : 'Cache not found',
      );
    } catch (cause) {
      log.warn('Failed to restore cache', { cause });
    }
    return this;
  }

  override update(): void {
    this.#forceUpdate = true;
  }

  override get hit(): boolean {
    return this.#matchedKey?.startsWith(this.#keys.primaryKey) ?? false;
  }

  override get restored(): boolean {
    return this.#matchedKey !== undefined;
  }

  @Expose()
  get key(): string {
    if (!this.hit) {
      return this.#keys.primaryKey;
    } else if (this.#forceUpdate) {
      return this.#keys.uniqueKey;
    } else {
      return this.#matchedKey!;
    }
  }

  override [Symbol.dispose](): void {
    super[Symbol.dispose]();
    const state = instanceToPlain<CacheEntry>(this, {
      groups: (this.#forceUpdate || !this.hit) ? ['update'] : [],
    });
    saveState(STATE_NAME, state);
    if ('target' in state) {
      log.info(
        'After the job completes, TEXDIR will be saved to cache with key: '
          + state.key,
      );
    }
  }
}

export async function save(): Promise<void> {
  try {
    const state = getState(STATE_NAME);
    if (state !== '') {
      await plainToInstance(SaveCacheEntry, JSON.parse(state)).save();
    }
  } catch (error) {
    if (error instanceof ReserveCacheError) {
      log.info(error.message);
    } else {
      log.warn('Failed to save to cache', { cause: error });
    }
  }
}

class SaveCacheEntry implements CacheEntry {
  readonly target?: string;
  readonly key?: string;

  async save(): Promise<void> {
    if (this.key !== undefined) {
      if (this.target === undefined) {
        log.info(
          `Cache hit occurred on the primary key ${this.key}, not saving cache`,
        );
      } else {
        if (await saveCache([this.target], this.key) !== -1) {
          log.info(`${this.target} saved with cache key: ${this.key}`);
        }
      }
    }
  }
}

class CacheKeys {
  readonly #distribution: `${NodeJS.Platform}-${string}-${Version}`;
  readonly #digest: string;
  readonly #id: string;

  constructor(entry: Omit<CacheEntryConfig, 'TEXDIR'>) {
    this.#distribution = `${platform()}-${arch()}-${entry.version}`;
    this.#digest = digest([...entry.packages]);
    this.#id = randomString().replaceAll('-', '');
  }

  get uniqueKey(): string {
    return `${this.primaryKey}-${this.#id}`;
  }

  get primaryKey(): string {
    return `${this.secondaryKey}${this.#digest}`;
  }

  private get secondaryKey(): string {
    return `${ID['kebab-case']}-${this.#distribution}-`;
  }

  get restoreKeys(): [primaryKey: string, ...string[]] {
    return [this.primaryKey, this.secondaryKey];
  }
}

function digest(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj) ?? '').digest('hex');
}

function randomString(): string {
  return randomUUID().replaceAll('-', '');
}
