import type { TlmgrAction } from '#/texlive/tlmgr/action';
import type { Version } from '#/texlive/version';
import type { ExecOutput } from '#/util';
import { Exception } from '#/util/decorators';

export interface TlmgrErrorOptions extends ErrorOptions {
  action: TlmgrAction;
  subaction?: string;
  version?: Version;
}

@Exception
export class TlmgrError extends Error implements TlmgrErrorOptions {
  readonly action: TlmgrAction;
  declare readonly subaction?: string;
  declare readonly version?: Version;

  constructor(message: string, options: Readonly<TlmgrErrorOptions>) {
    super(message, options);
    this.action = options.action;
    if (options.subaction !== undefined) {
      this.subaction = options.subaction;
    }
    if (options.version !== undefined) {
      this.version = options.version;
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

  private static readonly RE = /^tlmgr install: package (\S+) not present/gmu;

  static check(
    output: Readonly<ExecOutput>,
    options: Readonly<TlmgrErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const packages = Array.from(
        output.stderr.matchAll(this.RE),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ([, found]) => found!,
      );
      if (packages.length > 0) {
        throw new this(packages, options);
      }
    }
  }
}

@Exception
export class RepositoryVersionConflicts extends TlmgrError {
  declare local?: Version;
  repository: string | undefined;

  constructor(options: Readonly<TlmgrErrorOptions>) {
    const { version, ...rest } = options;
    super('Conflicting local and remote TeX Live versions', rest);
    if (version !== undefined) {
      this.local = version;
    }
  }

  private static readonly RE =
    /is older than remote repository(?: \((?<remote>\d{4})\))/u;

  static check(
    output: Readonly<ExecOutput>,
    options: Readonly<TlmgrErrorOptions>,
  ): void {
    if (output.exitCode !== 0) {
      const found = this.RE.exec(output.stderr);
      if (found !== null) {
        const error = new this(options);
        error.repository = found.groups?.['remote'];
        throw error;
      }
    }
  }
}
