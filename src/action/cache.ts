import { createHash, randomUUID } from 'node:crypto';
import { arch, platform } from 'node:os';
import { env } from 'node:process';

import { getState, saveState } from '@actions/core';
import { Expose, plainToInstance } from 'class-transformer';

import * as log from '#/log';
import type { Version } from '#/texlive';
import { Serializable, restoreCache, saveCache } from '#/utility';

export interface CacheInfo {
  hit: boolean;
  full: boolean;
  restored: boolean;
}

export interface CacheEntry {
  readonly TEXDIR: string;
  readonly packages: Iterable<string>;
  readonly version: Version;
}

interface CacheKeys {
  readonly unique: string;
  readonly primary: string;
  readonly secondary: string;
}

export class CacheClient {
  private readonly TEXDIR: string;
  private readonly keys: CacheKeys;
  private readonly state: CacheState = new CacheState();
  private readonly info: CacheInfo = {
    hit: false,
    full: false,
    restored: false,
  };

  constructor(entry: CacheEntry) {
    this.TEXDIR = entry.TEXDIR;
    this.keys = getCacheKeys(entry);
  }

  async restore(): Promise<CacheInfo> {
    this.state.key = await restoreCache(
      this.TEXDIR,
      this.keys.unique,
      [this.keys.primary, this.keys.secondary],
    );
    this.info.restored = this.state.key !== undefined;
    this.info.full = this.state.key?.startsWith(this.keys.primary) === true;
    this.info.hit = !forceUpdate() && this.info.full;
    if (!this.info.hit) {
      this.update();
    }
    return this.info;
  }

  update(): void {
    if (this.state.target === undefined) {
      this.state.key = this.info.full ? this.keys.unique : this.keys.primary;
      this.state.target = this.TEXDIR;
      log.info(
        'After the job completes, TEXDIR will be saved to cache with key: '
          + this.state.key,
      );
    }
  }

  saveState(): void {
    this.state.save();
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

class CacheState extends Serializable {
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
    saveState(CacheState.STATE_NAME, JSON.stringify(this));
  }
}

function forceUpdate(): boolean {
  return (env['SETUP_TEXLIVE_FORCE_UPDATE_CACHE'] ?? '0') !== '0';
}

function getCacheKeys(entry: CacheEntry): CacheKeys {
  const secondary = `setup-texlive-${platform()}-${arch()}-${entry.version}-`;
  const primary = secondary + digest([...entry.packages]);
  const unique = `${primary}-${randomString()}`;
  return { unique, primary, secondary };
}

function digest(obj: unknown): string {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function randomString(): string {
  return randomUUID().replaceAll('-', '');
}
