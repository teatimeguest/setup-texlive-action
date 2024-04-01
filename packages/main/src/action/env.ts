import { tmpdir } from 'node:os';
import { env } from 'node:process';

import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import type { Env } from '#/texlive/install-tl/env';

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
    const key = `TEXLIVE_INSTALL_${tree}` satisfies keyof Env;
    if (tree !== 'TEXMFLOCAL' && key in env) {
      log.warn('`%s` is set, but ignored', key);
      delete env[key];
    }
  }
}

declare global {
  namespace NodeJS {
    /**
     * @see {@link https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables}
     */
    interface ProcessEnv {
      GITHUB_ACTIONS?: string;
      GITHUB_ACTION_PATH?: string;
      GITHUB_WORKSPACE?: string;
      RUNNER_DEBUG?: string;
      RUNNER_TEMP?: string;
    }
  }
}
