import * as path from 'node:path';

import deline from 'deline';

import { symbols } from '#/log';
import { TLError, type TLErrorOptions } from '#/texlive/errors';
import { Exception, type ExecOutput } from '#/util';

/**
 * @see {@link https://github.com/teatimeguest/setup-texlive-action/issues/226}
 */
@Exception
export class PackageChecksumMismatch extends TLError {
  private constructor(
    readonly packages: readonly string[],
    options?: Readonly<TLErrorOptions>,
  ) {
    super('Checksums of some packages did not match', options);
    this[symbols.note] = deline`
      The CTAN mirror may be in the process of synchronisation.
      Please try re-running the workflow after a while.
    `;
  }

  /** @see `tlpkg/TeXLive/TLUtils.pm` */
  private static readonly RE = /: checksums differ for (.+):$/gmv;

  static check(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    const packages = Array.from(
      output.stderr.matchAll(this.RE),
      ([, found]) => path.basename(found!, '.tar.xz'),
    );
    if (packages.length > 0) {
      throw new this([...new Set(packages.sort())], options);
    }
  }
}

@Exception
export class TlpdbError extends TLError {
  private constructor(
    readonly url: string,
    options?: Readonly<TLErrorOptions>,
  ) {
    super('Repository initialization failed', options);
    this[symbols.note] = deline`
      The repository may not have been synchronized yet.
      Please try re-running the workflow after a while.
    `;
  }

  /** @see `tlpkg/TeXLive/TLPDB.pm` */
  private static readonly ERRORS = {
    notFound: {
      re: /TLPDB::from_file could not initialize from: (.*)$/mv,
      note: deline`
        The repository may not have been synchronized yet.
        Please try re-running the workflow after a while.
      `,
    },
    checksumMismatch: {
      re: /from (.+): digest disagree/v,
      note: deline`
        The repository seems to have some problem.
        Please try re-running the workflow after a while.
      `,
    },
  } as const;

  static check(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    for (const [key, { re, note }] of Object.entries(this.ERRORS)) {
      if (key === 'notFound' && output.exitCode === 0) {
        continue;
      }
      const url = re.exec(output.stderr)?.[1];
      if (url !== undefined) {
        const error = new this(url, options);
        error[symbols.note] = note;
        error['stderr'] = output.stderr;
        throw error;
      }
    }
  }
}
