import {
  type ExecOptions,
  type ExecResult,
  exec,
} from '@setup-texlive-action/utils';
import { createContext } from 'unctx';

import { SUPPORTED_VERSIONS } from '#/texlive/tlmgr/action';
import { TlmgrError } from '#/texlive/tlmgr/errors';
import { Version } from '#/texlive/version';

export interface TlmgrConfig {
  readonly TEXDIR: string;
  readonly version: Version;
}

export class TlmgrInternals implements TlmgrConfig {
  readonly TEXDIR: string;
  readonly version: Version;

  constructor(config: TlmgrConfig) {
    this.TEXDIR = config.TEXDIR;
    this.version = config.version;
  }

  async exec(
    action: keyof typeof SUPPORTED_VERSIONS,
    args?: Iterable<string>,
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    options?: ExecOptions,
  ): Promise<ExecResult> {
    if (!Version.satisfies(this.version, SUPPORTED_VERSIONS[action])) {
      throw new TlmgrError(
        `\`tlmgr ${action}\` not implemented in this version of TeX Live`,
        { action, version: this.version },
      );
    }
    return await exec('tlmgr', [action, ...(args ?? [])], options);
  }
}

export const { set, use } = createContext<TlmgrInternals>();
