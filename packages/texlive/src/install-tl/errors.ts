import { symbols } from '@setup-texlive-action/logger';
import { Exception, type ExecOutput } from '@setup-texlive-action/utils';
import deline from 'deline';

import { TLError, type TLErrorOptions } from '#texlive/errors';

@Exception
export class InstallTLError extends TLError {
  declare readonly code?: InstallTLError.Code;
}

export namespace InstallTLError {
  const CODES = [
    'INCOMPATIBLE_REPOSITORY_VERSION',
    'UNEXPECTED_VERSION',
    'FAILED_TO_DOWNLOAD',
  ] as const;

  export type Code = typeof CODES[number];

  export const Code = Object.fromEntries(
    CODES.map((code) => [code, code]),
  ) as {
    readonly [K in Code]: K;
  };
}

export namespace InstallTLError {
  const MSG = 'repository being accessed are not compatible';
  // eslint-disable-next-line regexp/no-super-linear-move
  const RE = /^\s*repository:\s*(?<remote>20\d{2})/mv;

  export function checkCompatibility(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    if (output.exitCode !== 0 && output.stderr.includes(MSG)) {
      const remoteVersion = RE.exec(output.stderr)?.groups?.['remote'];
      const error = new InstallTLError(
        'The repository is not compatible with this version of install-tl',
        {
          ...options,
          code: InstallTLError.Code.INCOMPATIBLE_REPOSITORY_VERSION,
          remoteVersion,
        },
      );
      error[symbols.note] = deline`
        The CTAN mirrors may not have completed synchronisation
        against a release of new version of TeX Live.
        Please try re-running the workflow after a while.
      `;
      throw error;
    }
  }
}
