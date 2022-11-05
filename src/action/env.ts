import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { env } from 'node:process';

import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import type { Version } from '#/texlive/version';
import type { SystemTrees } from '#/texmf';

export interface Env {
  readonly SETUP_TEXLIVE_FORCE_UPDATE_CACHE?: string;

  readonly TEXLIVE_DOWNLOADER?: string;
  readonly TL_DOWNLOAD_PROGRAM?: string;
  readonly TL_DOWNLOAD_ARGS?: string;
  readonly TEXLIVE_INSTALL_ENV_NOCHECK: string;
  readonly TEXLIVE_INSTALL_NO_CONTEXT_CACHE?: string;
  readonly TEXLIVE_INSTALL_NO_DISKCHECK?: string;
  readonly TEXLIVE_INSTALL_NO_RESUME?: string;
  readonly TEXLIVE_INSTALL_NO_WELCOME: string;
  readonly TEXLIVE_INSTALL_PAPER?: string;
  readonly TEXLIVE_INSTALL_PREFIX: string;
  readonly TEXLIVE_INSTALL_TEXMFLOCAL?: string;
  readonly TEXLIVE_INSTALL_TEXMFCONFIG: string;
  readonly TEXLIVE_INSTALL_TEXMFVAR: string;
  readonly TEXLIVE_INSTALL_TEXMFHOME: string;
  readonly NOPERLDOC?: string;
}

export namespace Env {
  export function load(version: Version): Env {
    if ((env as Record<string, string>)['RUNNER_TEMP'] === undefined) {
      log.warn(`\`RUNNER_TEMP\` not defined, ${tmpdir()} will be used instead`);
      env.RUNNER_TEMP = tmpdir();
    }
    // Use RUNNER_TEMP as a temporary directory during setup.
    env['TMPDIR'] = env.RUNNER_TEMP;
    type Keys = `TEXLIVE_INSTALL_${Exclude<keyof SystemTrees, 'TEXMFLOCAL'>}`;
    for (const key of keys<Record<Keys, unknown>>()) {
      if (env[key] !== undefined) {
        log.warn(`\`${key}\` is set, but ignored`);
        delete env[key];
      }
    }
    for (const [key, value] of Object.entries(defaults(version))) {
      env[key] ??= value;
    }
    return env as unknown as Env;
  }

  export function defaults(version: Version): Env {
    const TEXUSERDIR = path.join(
      homedir(),
      '.local',
      'texlive',
      version.toString(),
    );
    return {
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
      TEXLIVE_INSTALL_PREFIX: path.join(env.RUNNER_TEMP, 'setup-texlive'),
      TEXLIVE_INSTALL_TEXMFHOME: path.join(homedir(), 'texmf'),
      TEXLIVE_INSTALL_TEXMFCONFIG: path.join(TEXUSERDIR, 'texmf-config'),
      TEXLIVE_INSTALL_TEXMFVAR: path.join(TEXUSERDIR, 'texmf-var'),
    };
  }
}
