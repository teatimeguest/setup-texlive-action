import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as log from '#/log';

export function getInput(name: string, options?: {
  readonly type?: typeof String;
}): string | undefined;
export function getInput(name: string, options: {
  readonly type?: typeof String;
  readonly default: string;
}): string;
export function getInput(name: string, options: {
  readonly type: typeof Boolean;
}): boolean;

export function getInput(name: string, options?: {
  readonly type?: typeof String | typeof Boolean;
  readonly default?: string;
}): string | boolean | undefined {
  switch (options?.type) {
    case Boolean: {
      return core.getBooleanInput(name);
    }
    default: {
      const input = core.getInput(name);
      return input === '' ? options?.default : input;
    }
  }
}

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
