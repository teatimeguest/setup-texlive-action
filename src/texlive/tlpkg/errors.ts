import path from 'node:path';

import { Exception, type ExecOutput } from '#/util';

@Exception
export class PackageChecksumMismatch extends Error {
  constructor(
    readonly packages: ReadonlyArray<string>,
    options?: Readonly<ErrorOptions>,
  ) {
    super(
      'The checksums of some packages did not match. '
        + 'This may be due to '
        + 'the CTAN mirror being in the process of synchronisation. '
        + 'Please try re-running the workflow after a while.',
      options,
    );
  }

  // Reference: tlpkg/TeXLive/TLUtils.pm
  private static readonly RE = /: checksums differ for (.+):$/gmu;

  static check(output: Readonly<ExecOutput>): void {
    const packages = Array.from(
      output.stderr.matchAll(this.RE),
      ([, found]) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return path.basename(found!, '.tar.xz');
      },
    );
    if (packages.length > 0) {
      throw new this(packages);
    }
  }
}
