import { exportVariable } from '@actions/core';

import * as log from '#/log';
import { type UserTrees, kpse } from '#/tex';
import { use } from '#/texlive/tlmgr/internals';
import * as tlpkg from '#/texlive/tlpkg';
import { exec } from '#/util';

export type KpseVar = keyof UserTrees | 'TEXMFLOCAL';

export function texmf(key: KpseVar): Promise<string | undefined>;
export function texmf(key: KpseVar, value: string): Promise<void>;

export async function texmf(
  key: KpseVar,
  value?: string,
): Promise<string | undefined | void> {
  if (value === undefined) {
    return await kpse.varValue(key);
  }
  const internals = use();
  // `tlmgr conf` is not implemented prior to 2010.
  if (internals.version < '2010') {
    exportVariable(key, value);
  } else {
    await internals.exec('conf', ['texmf', key, value]);
  }
  if (key === 'TEXMFLOCAL') {
    try {
      // Minimal initialisation.
      await tlpkg.makeLocalSkeleton(value, internals);
      await exec('mktexlsr', [value]);
    } catch (cause) {
      log.info('Failed to initialize TEXMFLOCAL', { cause });
    }
  }
}
