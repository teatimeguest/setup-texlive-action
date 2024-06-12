import * as path from 'node:path';

import { symbols } from '@setup-texlive-action/logger';
import { Exception, type ExecOutput } from '@setup-texlive-action/utils';
import deline from 'deline';

import { TLError, type TLErrorOptions } from '#texlive/errors';

@Exception
export class TlpdbError extends TLError {
  declare readonly code?: TlpdbError.Code;
}

export namespace TlpdbError {
  const CODES = [
    'PACKAGE_CHECKSUM_MISMATCH',
    'FAILED_TO_INITIALIZE',
    'TLPDB_CHECKSUM_MISMATCH',
  ] as const;

  export type Code = typeof CODES[number];

  export const Code = Object.fromEntries(
    CODES.map((code) => [code, code]),
  ) as {
    readonly [K in Code]: K;
  };
}

export namespace TlpdbError {
  /** @see `tlpkg/TeXLive/TLUtils.pm` */
  const RE = /: checksums differ for (.+):$/gmv;

  /**
   * @see {@link https://github.com/teatimeguest/setup-texlive-action/issues/226}
   */
  export function checkPackageChecksumMismatch(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    const packages = Array.from(
      output.stderr.matchAll(RE),
      ([, found]) => path.basename(found!, '.tar.xz'),
    );
    if (packages.length > 0) {
      const error = new TlpdbError(
        'Checksums of some packages did not match',
        { ...options, code: TlpdbError.Code.PACKAGE_CHECKSUM_MISMATCH },
      );
      error['packages'] = [...new Set(packages.sort())];
      error[symbols.note] = deline`
        The CTAN mirror may be in the process of synchronisation.
        Please try re-running the workflow after a while.
      `;
      throw error;
    }
  }
}

export namespace TlpdbError {
  /** @see `tlpkg/TeXLive/TLPDB.pm` */
  const RE = /TLPDB::from_file could not initialize from: (.*)$/mv;

  export function checkRepositoryStatus(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const url = RE.exec(output.stderr)?.[1];
      if (url !== undefined) {
        const error = new TlpdbError(
          'Repository initialization failed',
          { ...options, code: TlpdbError.Code.FAILED_TO_INITIALIZE },
        );
        error[symbols.note] = deline`
          The repository may not have been synchronized yet.
          Please try re-running the workflow after a while.
        `;
        error['stderr'] = output.stderr;
        error['url'] = url;
        throw error;
      }
    }
  }
}

export namespace TlpdbError {
  /** @see `tlpkg/TeXLive/TLPDB.pm` */
  const RE = /from (.+): digest disagree/v;

  export function checkRepositoryHealth(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    const url = RE.exec(output.stderr)?.[1];
    if (url !== undefined) {
      const error = new TlpdbError(
        'Repository initialization failed',
        { ...options, code: TlpdbError.Code.TLPDB_CHECKSUM_MISMATCH },
      );
      error[symbols.note] = deline`
        The repository seems to have some problem.
        Please try re-running the workflow after a while.
      `;
      error['stderr'] = output.stderr;
      error['url'] = url;
      throw error;
    }
  }
}
