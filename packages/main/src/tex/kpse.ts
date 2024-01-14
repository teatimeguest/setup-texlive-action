import * as path from 'node:path';

import type { Texmf } from '#/tex/texmf';
import { exec } from '#/util/exec';

export async function varValue(
  variable: Exclude<keyof Texmf, 'TEXDIR'>,
): Promise<string | undefined> {
  const { exitCode, stdout } = await exec('kpsewhich', [
    `-var-value=${variable}`,
  ], {
    ignoreReturnCode: true,
    silent: true,
  });
  return exitCode === 0
    ? path.normalize(stdout.replace(/\r?\n$/v, ''))
    : undefined;
}
