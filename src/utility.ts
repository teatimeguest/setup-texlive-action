import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

export type ArchiveType = 'tgz' | 'zip';

/**
 * Extracts files from an archive.
 *
 * @returns Path to the directory containing the files.
 */
export async function extract(
  filepath: string,
  kind: ArchiveType,
): Promise<string> {
  switch (kind) {
    case 'tgz':
      return await tool.extractTar(filepath, undefined, ['xz', '--strip=1']);
    case 'zip': {
      const subdir = await determine(
        path.join(await tool.extractZip(filepath), '*'),
      );
      if (subdir === undefined) {
        throw new Error('Unable to locate the unzipped directory');
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
  core.debug(
    `Found ${
      matched.length === 0 ? 'no' : 'multiple'
    } matches to the pattern ${pattern}${
      matched.length === 0 ? '' : `: ${matched}`
    }`,
  );
  return undefined;
}

export async function saveToolCache(
  directory: string,
  target: string,
  version: string,
): Promise<void> {
  try {
    core.info('Adding to tool cache');
    await tool.cacheDir(directory, target, version);
  } catch (error) {
    core.info(`Failed to add to tool cache: ${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
}

export async function restoreToolCache(
  target: string,
  version: string,
): Promise<string | undefined> {
  try {
    const dest = tool.find(target, version);
    if (dest !== '') {
      core.info('Found in the tool cache');
      return dest;
    }
  } catch (error) {
    core.info(`Failed to restore tool cache: ${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
  return undefined;
}

export async function saveCache(
  target: string,
  primaryKey: string,
): Promise<void> {
  try {
    await cache.saveCache([target], primaryKey);
    core.info(`Cache saved`);
  } catch (error) {
    core.warning(`Failed to save to cache: ${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
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
      return key === primaryKey ? 'primary' : 'secondary';
    }
    core.info('Cache not found');
  } catch (error) {
    core.info(`Failed to restore cache: ${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
  return undefined;
}

export function tmpdir(): string {
  const runnerTemp = process.env['RUNNER_TEMP'];
  return runnerTemp !== undefined && runnerTemp !== ''
    ? runnerTemp
    : os.tmpdir();
}

/**
 * Updates the contents of a file.
 */
export async function updateFile(
  filename: string,
  ...replacements: ReadonlyArray<
    Readonly<{ search: string | Readonly<RegExp>; replace: string }>
  >
): Promise<void> {
  const content = await fs.readFile(filename, 'utf8');
  const updated = replacements.reduce(
    (str, { search, replace }) => str.replace(search, replace),
    content,
  );
  await fs.writeFile(filename, updated);
}

export type EntryOf<T extends object> = [keyof T, T[keyof T]];

/**
 * Creates a union type consisting of all string literals from `Begin` to `End`.
 *
 * ```typescript
 * type T = Indices<'10', '15'>   // ['10', '11', '12', '13', '14']
 * type U = Indices<'foo', 'bar'> // never
 * ```
 */
export type Indices<Begin extends string, End extends string> = Exclude<
  keyof Times<End, [unknown]>,
  keyof Times<Begin, [unknown]>
>;

type Digits = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type Init<T extends string> = T extends `${infer Rest}${Digits}` ? Rest : never;

type Last<T extends string> = T extends `${Init<T>}${infer N}` ? N : never;

type Times<N extends string, T extends Array<unknown>> =
  // prettier-ignore
  | N extends '0' ? []
  : N extends '1' ? [...T]
  : N extends '2' ? [...T, ...T]
  : N extends '3' ? [...T, ...T, ...T]
  : N extends '4' ? [...T, ...T, ...T, ...T]
  : N extends '5' ? [...T, ...T, ...T, ...T, ...T]
  : N extends '6' ? [...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '7' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '8' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '9' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : N extends '10' ? [...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T, ...T]
  : [...Times<'10', Times<Init<N>, T>>, ...Times<Last<N>, T>];

declare module 'util/types' {
  /**
   * A type-guard for the error type of Node.js.
   * Since `NodeJS.ErrnoException` is defined as an interface,
   * we cannot write `error instanceof NodeJS.ErrnoException`, but
   * `util.types.isNativeError` is sufficient
   * because all properties of `NodeJS.ErrnoException` are optional.
   */
  function isNativeError(error: unknown): error is NodeJS.ErrnoException;
}
