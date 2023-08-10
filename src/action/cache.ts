import { createHash, randomUUID } from 'node:crypto';
import { arch, platform } from 'node:os';
import { env } from 'node:process';

import * as cache from '@actions/cache';
import { getState, saveState } from '@actions/core';
import {
  Exclude,
  Expose,
  instanceToPlain,
  plainToInstance,
} from 'class-transformer';

import { ID } from '#/action/id';
import * as log from '#/log';
import type { Version } from '#/texlive';

export interface CacheInfo {
  hit: boolean;
  restored: boolean;
}

export interface CacheEntry {
  readonly TEXDIR: string;
  readonly packages: Iterable<string>;
  readonly version: Version;
}

export interface CacheServiceConfig {
  /** @defaultValue `false` */
  readonly disable?: boolean;
}

export class CacheService implements CacheInfo {
  readonly disabled: boolean;

  private readonly TEXDIR: string;
  private readonly keys: CacheKeys;
  private readonly state: CacheState = new CacheState();
  private readonly info: CacheInfo = { hit: false, restored: false };

  constructor(entry: CacheEntry, config?: CacheServiceConfig) {
    this.TEXDIR = entry.TEXDIR;
    this.keys = new CacheKeys(entry);
    this.disabled = config?.disable ?? false;
    if (!this.disabled && !cache.isFeatureAvailable()) {
      log.warn('Caching is disabled since cache service is not available');
      this.disabled = true;
    }
  }

  async restore(): Promise<CacheInfo> {
    if (!this.disabled) {
      const restoreKey = await restoreCache(this.TEXDIR, ...this.keys.get());
      if (restoreKey !== undefined) {
        this.state.key = restoreKey;
        this.info.restored = true;
        this.info.hit = this.keys.isPrimary(this.state.key);
      }
      if (forceUpdate() || !this.info.hit) {
        this.update();
      }
    }
    return this;
  }

  update(): void {
    if (!this.disabled && this.state.target === undefined) {
      this.state.key = this.hit ? this.keys.unique : this.keys.primary;
      this.state.target = this.TEXDIR;
    }
  }

  saveState(): void {
    if (!this.disabled) {
      if (this.state.target !== undefined && this.state.key !== undefined) {
        log.info(
          'After the job completes, TEXDIR will be saved to cache with key: '
            + this.state.key,
        );
      }
      this.state.save();
    }
  }

  get hit(): boolean {
    return this.info.hit;
  }

  get restored(): boolean {
    return this.info.restored;
  }
}

export async function save(): Promise<void> {
  const state = CacheState.restore();
  if (state?.key !== undefined) {
    if (state.target !== undefined) {
      await saveCache(state.target, state.key);
    } else {
      log.info(
        `Cache hit occurred on the primary key ${state.key}, not saving cache`,
      );
    }
  }
}

@Exclude()
class CacheState {
  static readonly STATE_NAME = 'CACHE';

  @Expose()
  key?: string | undefined;
  @Expose()
  target?: string;

  static restore(): CacheState | undefined {
    const state = getState(CacheState.STATE_NAME);
    return state !== ''
      ? plainToInstance(CacheState, JSON.parse(state))
      : undefined;
  }

  save(): void {
    saveState(CacheState.STATE_NAME, JSON.stringify(instanceToPlain(this)));
  }
}

function forceUpdate(): boolean {
  const key = `${ID.SCREAMING_SNAKE_CASE}_FORCE_UPDATE_CACHE`;
  return (env[key] ?? '0') !== '0';
}

class CacheKeys {
  readonly primary: string;
  readonly secondary: string;

  #unique: string | undefined;

  constructor(entry: CacheEntry) {
    this.secondary = `${
      ID['kebab-case']
    }-${platform()}-${arch()}-${entry.version}-`;
    this.primary = this.secondary + digest([...entry.packages]);
  }

  get unique(): string {
    return this.#unique ??= `${this.primary}-${randomString()}`;
  }

  get(): [primaryKey: string, restoreKeys: Array<string>] {
    return [this.unique, [this.primary, this.secondary]];
  }

  isPrimary(key: string): boolean {
    return key.startsWith(this.primary);
  }
}

function digest(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj) ?? '').digest('hex');
}

function randomString(): string {
  return randomUUID().replaceAll('-', '');
}

/** @internal */
export async function saveCache(
  target: string,
  primaryKey: string,
): Promise<void> {
  try {
    await cache.saveCache([target], primaryKey);
    log.info(`${target} saved with cache key: ${primaryKey}`);
  } catch (error) {
    if (error instanceof cache.ReserveCacheError) {
      log.info(error.message);
    } else {
      log.warn('Failed to save to cache', { cause: error });
    }
  }
}

/** @internal */
export async function restoreCache(
  target: string,
  primaryKey: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  restoreKeys: Array<string>,
): Promise<string | undefined> {
  let key: string | undefined;
  try {
    key = await cache.restoreCache([target], primaryKey, restoreKeys);
    if (key !== undefined) {
      log.info(`${target} restored from cache with key: ${key}`);
    } else {
      log.info('Cache not found');
    }
  } catch (cause) {
    log.warn('Failed to restore cache', { cause });
  }
  return key;
}
