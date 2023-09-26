import { Range } from 'semver';

import { TLError, type TLErrorOptions } from '#/texlive/errors';
import type { TlmgrAction } from '#/texlive/tlmgr/action';
import { Version } from '#/texlive/version';
import { Exception, type ExecOutput, type MarkNonNullable } from '#/util';

export interface TlmgrErrorOptions extends TLErrorOptions {
  action: TlmgrAction;
  subaction?: string | undefined;
}

@Exception
export class TlmgrError extends TLError implements TlmgrErrorOptions {
  readonly action: TlmgrAction;
  declare readonly subaction?: string;

  constructor(message: string, options: Readonly<TlmgrErrorOptions>) {
    super(message, options);
    this.action = options.action;
    if (options.subaction !== undefined) {
      this.subaction = options.subaction;
    }
  }
}

@Exception
export class PackageNotFound extends TlmgrError {
  constructor(
    readonly packages: ReadonlyArray<string>,
    options: Readonly<TlmgrErrorOptions>,
  ) {
    super('Some packages not found in the repository', options);
  }

  private static readonly PATTERNS = [
    {
      versions: new Range('2008'),
      re: /: Cannot find package (.+)$/gmu,
    },
    {
      versions: new Range('>=2009 <2015'),
      re: /^package (.+) not present in package repository/gmu,
    },
    {
      versions: new Range('>=2015'),
      re: /^tlmgr install: package (\S+) not present/gmu,
    },
  ] as const;

  static check(
    output: Readonly<ExecOutput>,
    options: Readonly<MarkNonNullable<TlmgrErrorOptions, 'version'>>,
  ): void {
    // Missing packages is not an error in versions prior to 2015.
    if (options.version < '2015' || output.exitCode !== 0) {
      const pattern = this.PATTERNS.find(({ versions }) => {
        return Version.satisfies(options.version, versions);
      });
      const packages = Array.from(
        output.stderr.matchAll(pattern!.re),
        ([, found]) => found!,
      );
      if (packages.length > 0) {
        throw new this(packages, options);
      }
    }
  }
}

@Exception
export class TLVersionOutdated extends TlmgrError {
  private constructor(options: Readonly<TlmgrErrorOptions>) {
    super('The TeX Live version is outdated', options);
  }

  private static readonly RE =
    /is older than remote repository(?: \((?<remote>\d{4})\))/u;

  static check(
    output: Readonly<ExecOutput>,
    options: Readonly<TlmgrErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const remoteVersion = this.RE.exec(output.stderr)?.groups?.['remote'];
      if (remoteVersion !== undefined) {
        throw new this({ ...options, remoteVersion });
      }
    }
  }
}
