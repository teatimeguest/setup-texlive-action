import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { type ExecOutput, exec } from '@actions/exec';

import * as log from '#/log';
import type { IterableIterator } from '#/utility';

/**
 * Check tlpkg's logs to find problems.
 */
export function check(output: string | Readonly<ExecOutput>): void {
  const stderr = typeof output === 'string' ? output : output.stderr;
  // tlpkg/TeXLive/TLUtils.pm
  const result = /: checksums differ for (.*):$/mu.exec(stderr);
  if (result !== null) {
    const pkg = path.basename(result[1] ?? '', '.tar.xz');
    throw new Error(
      `The checksum of package ${pkg} did not match. `
        + 'The CTAN mirror may be in the process of synchronization, '
        + 'please rerun the job after some time.',
    );
  }
}

/**
 * Initialize TEXMFLOCAL just as the installer does.
 */
export async function makeLocalSkeleton(
  texmflocal: string,
  options: { readonly TEXDIR: string },
): Promise<void> {
  await exec('perl', [
    `-I${path.join(options.TEXDIR, 'tlpkg')}`,
    '-mTeXLive::TLUtils=make_local_skeleton',
    '-e',
    'make_local_skeleton shift',
    texmflocal,
  ]);
}

export interface Tlpobj {
  readonly name: string;
  readonly version?: string | undefined;
  readonly revision: string;
}

export async function* tlpdb(
  tlpdbPath: string,
): AsyncGenerator<Tlpobj, void, void> {
  let db: string;
  try {
    db = await readFile(tlpdbPath, 'utf8');
  } catch (cause) {
    log.debug(`Failed to read ${tlpdbPath}`, { cause });
    return;
  }
  const nonPackage = /(?:^(?:collection|scheme)-|\.)/u;
  const version = /^catalogue-version\s+(.*)$/mu;
  const revision = /^revision\s+(\d+)\s*$/mu;
  // dprint-ignore
  const iter: IterableIterator<string, undefined> = db
    .replaceAll(/\\\r?\n/gu, '') // Remove escaped line breaks
    .replaceAll(/#.*/gu, '')     // Remove comments
    .split(/^name\s(.*)$/gmu)    // Split into individual packages
    .values();
  iter.next(); // The first chunk should contain nothing.
  for (let name of iter) {
    name = name.trimEnd();
    const data = iter.next().value;
    if (name === 'texlive.infra' || !nonPackage.test(name)) {
      yield {
        name,
        version: data?.match(version)?.[1]?.trimEnd() ?? undefined,
        revision: data?.match(revision)?.[1] ?? '',
      };
    }
  }
}
