import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';
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
    case 'tgz': {
      return await tool.extractTar(archive, undefined, ['xz', '--strip=1']);
    }
    case 'zip': {
      const pattern = path.join(await tool.extractZip(archive), '*');
      const subdir = await determine(pattern);
      if (subdir === undefined) {
        throw new Error(`Unable to locate subdirectory matched to ${pattern}`);
      }
      return subdir;
    }
  }
}

/**
 * @returns The unique path that matches the given glob pattern.
 */
export async function determine(pattern: string): Promise<string | undefined> {
  const globber = await glob.create(pattern, { implicitDescendants: false });
  const matched = await globber.glob();
  if (matched.length === 1) {
    return matched[0];
  }
  if (matched.length === 0) {
    log.debug(`No matches to pattern \`${pattern}\` found`);
  } else {
    log.debug(`Multiple matches to pattern \`${pattern}\` found: ${matched}`);
  }
  return undefined;
}

export async function saveCache(
  target: string,
  primaryKey: string,
): Promise<void> {
  try {
    await cache.saveCache([target], primaryKey);
    log.info(`${target} saved with cache key ${primaryKey}`);
  } catch (error) {
    log.warn('Failed to save to cache', { cause: error });
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
      return key === primaryKey ? 'primary' : 'secondary';
    }
    log.info('Cache not found');
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
