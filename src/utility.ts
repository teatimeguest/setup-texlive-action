import { promises as fs } from 'fs';

import * as glob from '@actions/glob';

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
