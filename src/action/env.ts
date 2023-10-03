import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { env } from 'node:process';

import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import type { Env } from '#/texlive/install-tl/env';
import { UserTrees } from '#/texlive/install-tl/texmf';
import type { Version } from '#/texlive/version';

export function init(): void {
  if (!('RUNNER_TEMP' in env)) {
    log.warn('`RUNNER_TEMP` not defined, %s will be used instead', tmpdir());
    (env as Record<string, string>)['RUNNER_TEMP'] = tmpdir();
  }
  // Use RUNNER_TEMP as a temporary directory during setup.
  env['TMPDIR'] = env.RUNNER_TEMP;

  env.TEXLIVE_INSTALL_ENV_NOCHECK ??= '1';
  env.TEXLIVE_INSTALL_NO_WELCOME ??= '1';

  for (const tree of Texmf.SYSTEM_TREES) {
    const key = `TEXLIVE_INSTALL_${tree}` satisfies keyof Env;
    if (tree !== 'TEXMFLOCAL' && key in env) {
      log.warn('`%s` is set, but ignored', key);
      delete env[key];
    }
  }
}

export function setDefaultTexmfUserTrees(version: Version): void {
  const TEXUSERDIR = path.join(homedir(), '.local', 'texlive', version);
  env.TEXLIVE_INSTALL_TEXMFHOME ??= path.join(homedir(), 'texmf');
  const trees = new UserTrees(version, { texdir: TEXUSERDIR });

  for (const key of Texmf.USER_TREES) {
    env[`TEXLIVE_INSTALL_${key}` satisfies keyof Env] ??= trees[key];
  }
}
