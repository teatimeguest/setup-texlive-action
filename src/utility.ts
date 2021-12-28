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
      const subdir = await expand(
        path.join(await tool.extractZip(filepath), '*'),
      );
      if (subdir.length !== 1 || subdir[0] === undefined) {
        core.debug(`Matched: ${subdir}`);
        throw new Error('Unable to locate the unzipped directory');
      }
      return subdir[0];
    }
  }
}

/**
 * @returns Array of paths that match the given glob pattern.
 */
export async function expand(pattern: string): Promise<Array<string>> {
  const globber = await glob.create(pattern, { implicitDescendants: false });
  return await globber.glob();
}

/**
 * A type-guard for the error type of Node.js.
 * Since `NodeJS.ErrnoException` is defined as an interface,
 * we cannot write `error instanceof ErrnoException`.
 */
export function isNodejsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

export function tmpdir(): string {
  const runnerTemp = process.env['RUNNER_TEMP'];
  return runnerTemp !== undefined && runnerTemp !== ''
    ? runnerTemp
    : os.tmpdir();
}

type Mutable<T> = {
  -readonly [Key in keyof T]: Mutable<T[Key]>;
};
type FromEntries<Entries> = Entries extends Array<[infer Keys, unknown]>
  ? {
      [Key in Keys extends string ? Keys : never]: Extract<
        Entries extends ReadonlyArray<infer Entry> ? Entry : never,
        [Key, unknown]
      >[1];
    }
  : never;

declare global {
  interface ObjectConstructor {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    fromEntries<T>(entries: T): FromEntries<Mutable<T>>;
  }
}
