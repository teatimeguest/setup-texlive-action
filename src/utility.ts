import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import * as cache from '@actions/cache';
import { create as createGlobber } from '@actions/glob';
import { rmRF } from '@actions/io';
import { extractTar, extractZip } from '@actions/tool-cache';
import {
  type ClassTransformOptions,
  Exclude,
  instanceToPlain,
} from 'class-transformer';

import * as log from '#/log';

export abstract class Serializable {
  constructor() {
    Exclude()(this.constructor);
  }

  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  toPlain(options?: ClassTransformOptions): object {
    return instanceToPlain(this, options);
  }

  toJSON(): object {
    return this.toPlain();
  }
}

/**
 * Extracts files from an archive.
 *
 * @returns Path to the directory containing the files.
 */
export async function extract(
  archive: string,
  kind: 'zip' | 'tgz',
): Promise<string> {
  switch (kind) {
    case 'tgz':
      return await extractTar(archive, undefined, ['xz', '--strip=1']);
    case 'zip':
      try {
        return await determine(path.join(await extractZip(archive), '*'));
      } catch (cause) {
        throw new Error('Unable to locate subdirectory', { cause });
      }
  }
}

/**
 * @returns The unique path that matches the given glob pattern.
 */
export async function determine(pattern: string): Promise<string> {
  const globber = await createGlobber(pattern, { implicitDescendants: false });
  const matched = await globber.glob();
  if (matched.length === 1) {
    return matched[0] ?? '';
  }
  throw new Error(
    matched.length === 0
      ? `No matches to pattern \`${pattern}\` found`
      : `Multiple matches to pattern \`${pattern}\` found: ${
        matched.join('; ')
      }`,
  );
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

export function tmpdir(): string {
  return process.env['RUNNER_TEMP'] ?? os.tmpdir();
}

export async function* mkdtemp(): AsyncGenerator<string, void, void> {
  const tmp = await fs.mkdtemp(path.join(tmpdir(), 'setup-texlive-'));
  try {
    yield tmp;
  } finally {
    await rmRF(tmp);
  }
}
