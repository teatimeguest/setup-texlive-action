import { exportVariable } from '@actions/core';
import * as log from '@setup-texlive-action/logger';
import { exec } from '@setup-texlive-action/utils';

import { type Texmf, kpse } from '#texlive/tex';
import { use } from '#texlive/tlmgr/internals';
import * as tlpkg from '#texlive/tlpkg';

export type KpseVar = Exclude<
  keyof Texmf,
  'TEXDIR' | 'TEXMFSYSCONFIG' | 'TEXMFSYSVAR'
>;

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
    } catch (error) {
      log.info({ error }, 'Failed to initialize %s', key);
    }
  }
}
