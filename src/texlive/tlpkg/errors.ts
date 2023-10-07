import path from 'node:path';

import deline from 'deline';

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
    super('The checksums of some packages did not match', options);
    this['note'] = deline`
      The CTAN mirror may be in the process of synchronisation.
      Please try re-running the workflow after a while.
    `;
  }

  /** @see `tlpkg/TeXLive/TLUtils.pm` */
  private static readonly RE = /: checksums differ for (.+):$/gmu;

  static check(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    const packages = Array.from(
      output.stderr.matchAll(this.RE),
      ([, found]) => path.basename(found!, '.tar.xz'),
    );
    if (packages.length > 0) {
      throw new this(packages, options);
    }
  }
}

@Exception
export class TlpdbNotFound extends TLError {
  private constructor(
    readonly url: string,
    options?: Readonly<TLErrorOptions>,
  ) {
    super('Repository initialization failed', options);
    this['note'] = deline`
      The repository may not have been synchronized yet.
      Please try re-running the workflow after a while.
    `;
  }

  /** @see `tlpkg/TeXLive/TLPDB.pm` */
  private static readonly RE =
    /TLPDB::from_file could not initialize from: (.*)$/mu;

  static check(
    output: Readonly<ExecOutput>,
    options?: Readonly<TLErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const url = this.RE.exec(output.stderr)?.[1] ?? undefined;
      if (url !== undefined) {
        throw new this(url, options);
      }
    }
  }
}
