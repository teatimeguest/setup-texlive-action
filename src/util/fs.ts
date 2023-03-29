import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import { rmRF } from '@actions/io';
import { extractTar, extractZip } from '@actions/tool-cache';

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
      return await extractTar(archive, undefined, ['xz', '--strip=1']);
    }
    case 'zip': {
      const parent = await extractZip(archive);
      try {
        return await uniqueChild(parent);
      } catch (cause) {
        throw new Error('Unable to locate unzipped subdirectory', { cause });
      }
    }
  }
}

export async function uniqueChild(parent: string): Promise<string> {
  const [child, ...rest] = await fs.readdir(parent);
  if (child === undefined) {
    throw new Error(`${parent} has no entries`);
  }
  if (rest.length > 0) {
    throw new Error(`${parent} has multiple entries`);
  }
  return path.join(parent, child);
}

export function tmpdir(): string {
  return env.RUNNER_TEMP;
}

export async function* mkdtemp(): AsyncGenerator<string, void, void> {
  const tmp = await fs.mkdtemp(path.join(tmpdir(), 'setup-texlive-'));
  try {
    yield tmp;
  } finally {
    await rmRF(tmp);
  }
}
