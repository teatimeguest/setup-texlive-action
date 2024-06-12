import * as path from 'node:path';

import { exec } from '@setup-texlive-action/utils';

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
