import { tmpdir } from 'node:os';
import { env } from 'node:process';

import * as log from '@setup-texlive-action/logger';
import { Texmf } from '@setup-texlive-action/texlive';

export function init(): void {
  if (!('RUNNER_TEMP' in env)) {
    log.warn('`RUNNER_TEMP` not defined, %s will be used instead', tmpdir());
    env.RUNNER_TEMP = tmpdir();
  }
  // Use RUNNER_TEMP as a temporary directory during setup.
  env['TMPDIR'] = env.RUNNER_TEMP;

  env.TEXLIVE_INSTALL_ENV_NOCHECK ??= '1';
  env.TEXLIVE_INSTALL_NO_WELCOME ??= '1';

  for (const tree of Texmf.SYSTEM_TREES) {
    const key = `TEXLIVE_INSTALL_${tree}`;
    if (tree !== 'TEXMFLOCAL' && key in env) {
      log.warn('`%s` is set, but ignored', key);
      delete env[key];
    }
  }
}
