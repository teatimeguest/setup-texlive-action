import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import { create as createGlobber } from '@actions/glob';
import { extractTar, extractZip } from '@actions/tool-cache';
import { type ClassTransformOptions, instanceToPlain } from 'class-transformer';

import * as log from '#/log';

export abstract class Serializable {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  toPlain(options?: ClassTransformOptions): object {
    return instanceToPlain(this, options);
  }

  toJSON(): object {
    return this.toPlain();
  }

  toString(): string {
    return JSON.stringify(this);
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

export type CacheType = 'primary' | 'secondary';

export async function restoreCache(
  target: string,
  primaryKey: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  restoreKeys: Array<string>,
): Promise<CacheType | undefined> {
  let key: string | undefined = undefined;
  try {
    key = await cache.restoreCache([target], primaryKey, restoreKeys);
    if (key !== undefined) {
      log.info(`${target} restored from cache key: ${key}`);
      return key === primaryKey ? 'primary' : 'secondary';
    } else {
      log.info('Cache not found');
    }
  } catch (error) {
    log.warn('Failed to restore cache', { cause: error });
  }
  return undefined;
}

export function tmpdir(): string {
  return process.env['RUNNER_TEMP'] ?? os.tmpdir();
}

/**
 * Creates a union type consisting of all string literals from `Begin` to `End`.
 *
 * ```typescript
 * type T1 = Range<'10', '15'>    // ['10', '11', '12', '13', '14']
 * type T1 = Range<'10', '=15'>   // ['10', '11', '12', '13', '14', '15']
 * type T3 = Range<'foo', 'bar'>  // never
 * ```
 */
export type Range<
  Begin extends `${number}`,
  End extends `${'' | '='}${number}`,
> =
  | Exclude<
    keyof Replicate<End extends `=${infer E}` ? E : End, [never]>,
    keyof Replicate<Begin, [never]>
  >
  | (End extends `=${infer E}` ? E : never);

type Digit = `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

type Init<T> = T extends `${infer L}${Digit}` ? L : never;
type Last<T> = T extends `${Init<T>}${infer N}` ? N : never;

type Replicate<N, T extends Array<unknown>> = N extends '0' ? []
  : N extends '1' ? [...T]
  : N extends '2' ? [...T, ...T]
  : N extends '3' ? [...T, ...T, ...T]
  : N extends '4' ? [...T, ...T, ...T, ...T]
  : N extends '5' ? [...T, ...T, ...T, ...T, ...T]
  : N extends '6' ? [...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '7' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '8' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '9' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '10'
    ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : [...Replicate<'10', Replicate<Init<N>, T>>, ...Replicate<Last<N>, T>];
