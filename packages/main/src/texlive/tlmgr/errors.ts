import { Range } from 'semver';

import { TLError, type TLErrorOptions } from '#/texlive/errors';
import type { TlmgrAction } from '#/texlive/tlmgr/action';
import { Version } from '#/texlive/version';
import { Exception, type ExecOutput, type Strict } from '#/util';

export interface TlmgrErrorOptions extends TLErrorOptions {
  code?: TlmgrError.Code;
  action: TlmgrAction;
  subaction?: string | undefined;
}

@Exception
export class TlmgrError extends TLError implements TlmgrErrorOptions {
  declare readonly code?: TlmgrError.Code;
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

export namespace TlmgrError {
  const CODES = [
    'TL_VERSION_OUTDATED',
    'TL_VERSION_NOT_SUPPORTED',
  ] as const;

  export type Code = typeof CODES[number];

  export const Code = Object.fromEntries(
    CODES.map((code) => [code, code]),
  ) as {
    readonly [C in Code]: C;
  };
}

export namespace TlmgrError {
  const RE = /is older than remote repository(?: \((?<remote>\d{4})\))?/v;

  export function checkOutdated(
    output: Readonly<ExecOutput>,
    options: Readonly<TlmgrErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const remoteVersion = RE.exec(output.stderr)?.groups?.['remote'];
      if (remoteVersion !== undefined) {
        throw new TlmgrError('The version of TeX Live is outdated', {
          ...options,
          code: TlmgrError.Code.TL_VERSION_OUTDATED,
          remoteVersion,
        });
      }
    }
  }
}

export namespace TlmgrError {
  const RE = /The TeX Live versions supported by the repository(?<rest>.*)/v;

  export function checkNotSupported(
    output: Readonly<ExecOutput>,
    options: Readonly<TlmgrErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const rest = RE.exec(output.stderr)?.groups?.['rest']?.trim();
      if (rest !== undefined) {
        const [repository, remote] = rest.split(/\r?\n/v);
        throw new TlmgrError(
          'The version of TeX Live is not supported by the repository',
          {
            ...options,
            code: TlmgrError.Code.TL_VERSION_NOT_SUPPORTED,
            repository: repository?.trim(),
            remoteVersion: remote?.trim().replaceAll(/^\(|\)$/gv, ''),
          },
        );
      }
    }
  }
}

@Exception
export class PackageNotFound extends TlmgrError {
  constructor(
    readonly packages: readonly string[],
    options: Readonly<TlmgrErrorOptions>,
  ) {
    super('Some packages not found in the repository', options);
  }

  private static readonly PATTERNS = [
    {
      versions: new Range('2008'),
      re: /: Cannot find package (.+)$/gmv,
    },
    {
      versions: new Range('>=2009 <2015'),
      re: /^package (.+) not present in package repository/gmv,
    },
    {
      versions: new Range('>=2015'),
      re: /^tlmgr install: package (\S+) not present/gmv,
    },
  ] as const;

  static check(
    output: Readonly<ExecOutput>,
    options: Readonly<Strict<TlmgrErrorOptions, 'version'>>,
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
