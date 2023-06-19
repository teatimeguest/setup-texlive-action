import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { env } from 'node:process';

import * as log from '#/log';
import type { Version } from '#/texlive/version';
import { SYSTEM_TREES } from '#/texmf';

export function init(version: Version): void {
  if (!('RUNNER_TEMP' in env)) {
    log.warn(`\`RUNNER_TEMP\` not defined, ${tmpdir()} will be used instead`);
    (env as Record<string, string>)['RUNNER_TEMP'] = tmpdir();
  }
  // Use RUNNER_TEMP as a temporary directory during setup.
  env['TMPDIR'] = env.RUNNER_TEMP;

  for (const tree of SYSTEM_TREES) {
    const key = `TEXLIVE_INSTALL_${tree}`;
    if (tree !== 'TEXMFLOCAL' && key in env) {
      log.warn(`\`${key}\` is set, but ignored`);
      delete env[key];
    }
  }

  const TEXUSERDIR = path.join(homedir(), '.local', 'texlive', version);
  const defaults = {
    TEXLIVE_INSTALL_ENV_NOCHECK: '1',
    TEXLIVE_INSTALL_NO_WELCOME: '1',
    TEXLIVE_INSTALL_PREFIX: path.join(env.RUNNER_TEMP, 'setup-texlive'),
    TEXLIVE_INSTALL_TEXMFHOME: path.join(homedir(), 'texmf'),
    TEXLIVE_INSTALL_TEXMFCONFIG: path.join(TEXUSERDIR, 'texmf-config'),
    TEXLIVE_INSTALL_TEXMFVAR: path.join(TEXUSERDIR, 'texmf-var'),
  };
  for (const [key, value] of Object.entries(defaults)) {
    env[key] ??= value;
  }
}
