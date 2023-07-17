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
  return exitCode === 0 ? stdout.replace(/\r?\n$/u, '') : undefined;
}
