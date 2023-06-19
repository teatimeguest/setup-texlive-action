import { exportVariable } from '@actions/core';

import * as log from '#/log';
import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';
import type { Texmf, UserTrees } from '#/texmf';
import { exec } from '#/util';

export interface Conf {
  texmf(key: keyof Texmf): Promise<string>;
  texmf(key: keyof UserTrees | 'TEXMFLOCAL', value: string): Promise<void>;
}

export class Conf {
  constructor(
    private readonly options: {
      readonly version: Version;
      readonly TEXDIR: string;
    },
  ) {}

  async texmf(key: keyof Texmf, value?: string): Promise<string | void> {
    if (value === undefined) {
      const { stdout } = await exec(
        'kpsewhich',
        ['-var-value', key],
        { silent: true },
      );
      return stdout.trim();
    }
    // `tlmgr conf` is not implemented prior to 2010.
    if (this.options.version < '2010') {
      exportVariable(key, value);
    } else {
      await exec('tlmgr', ['conf', 'texmf', key, value]);
    }
    // Unlike user directories,
    // system directories should be initialized at a minimum.
    if (key === 'TEXMFLOCAL') {
      try {
        await tlpkg.makeLocalSkeleton(value, this.options);
        await exec('mktexlsr', [value]);
      } catch (cause) {
        log.info('Failed to initialize TEXMFLOCAL', { cause });
      }
    }
  }
}
