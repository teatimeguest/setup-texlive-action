import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { env } from 'node:process';

import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import type { Env } from '#/texlive/install-tl/env';
import type { Version } from '#/texlive/version';

export function init(): void {
  if (!('RUNNER_TEMP' in env)) {
    log.warn(`\`RUNNER_TEMP\` not defined, ${tmpdir()} will be used instead`);
    (env as Record<string, string>)['RUNNER_TEMP'] = tmpdir();
  }
  // Use RUNNER_TEMP as a temporary directory during setup.
  env['TMPDIR'] = env.RUNNER_TEMP;

  /* eslint-disable @typescript-eslint/no-unnecessary-condition --
   * See: https://github.com/typescript-eslint/typescript-eslint/pull/6762
   */
  env.TEXLIVE_INSTALL_ENV_NOCHECK ??= '1';
  env.TEXLIVE_INSTALL_NO_WELCOME ??= '1';
  /* eslint-enable */

  for (const tree of Texmf.SYSTEM_TREES) {
    const key = `TEXLIVE_INSTALL_${tree}` satisfies keyof Env;
    if (tree !== 'TEXMFLOCAL' && key in env) {
      log.warn(`\`${key}\` is set, but ignored`);
      delete env[key];
    }
  }
}

export function setDefaultTexmfUserTrees(version: Version): void {
  const TEXUSERDIR = path.join(homedir(), '.local', 'texlive', version);
  const defaults = {
    TEXMFHOME: path.join(homedir(), 'texmf'),
    TEXMFCONFIG: path.join(TEXUSERDIR, 'texmf-config'),
    TEXMFVAR: path.join(TEXUSERDIR, 'texmf-var'),
  } as const satisfies Record<keyof Texmf.UserTrees, string>;

  for (const tree of Texmf.USER_TREES) {
    env[`TEXLIVE_INSTALL_${tree}` satisfies keyof Env] ??= defaults[tree];
  }
}
