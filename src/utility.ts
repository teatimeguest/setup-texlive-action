import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

/**
 * Updates the contents of a file.
 */
export async function updateFile(
  filename: string,
  ...replacements: ReadonlyArray<
    Readonly<{ search: string | RegExp; replace: string }>
  >
): Promise<void> {
  const content = await fs.readFile(filename, 'utf8');
  const updated = replacements.reduce(
    (str, { search, replace }) => str.replace(search, replace),
    content,
  );
  await fs.writeFile(filename, updated);
}

export type EntriesOf<T extends object> = Iterable<[keyof T, T[keyof T]]>;

export type ArchiveType = 'tar.gz' | 'zip';

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
    case 'tar.gz':
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

export function tmpdir(): string {
  const runnerTemp = process.env['RUNNER_TEMP'];
  return runnerTemp !== undefined && runnerTemp !== ''
    ? runnerTemp
    : os.tmpdir();
}

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
