import { ExecError, ExecResult, isIterable } from '@setup-texlive-action/utils';
import { P, match } from 'ts-pattern';

import { TlmgrError } from '#texlive/tlmgr/errors';
import { use } from '#texlive/tlmgr/internals';
import { TlpdbError } from '#texlive/tlpkg';

export interface UpdateOptions {
  readonly all?: boolean;
  readonly self?: boolean;
  readonly reinstallForciblyRemoved?: boolean;
}

export function update(): Promise<ExecResult>;
export function update(options: UpdateOptions): Promise<ExecResult>;
export function update(packages: Iterable<string>): Promise<ExecResult>;
export function update(
  packages: Iterable<string>,
  options: UpdateOptions,
): Promise<ExecResult>;
export async function update(
  ...inputs:
    | readonly []
    | readonly [UpdateOptions]
    | readonly [Iterable<string>]
    | readonly [Iterable<string>, UpdateOptions]
): Promise<ExecResult> {
  const internals = use();
  const [packages, options] = match(inputs)
    .returnType<[Iterable<string>, UpdateOptions | undefined]>()
    .with(
      [P._, P._],
      [P.when(isIterable)],
      ([packages, options]) => [packages, options],
    )
    .with(P._, ([options]) => [[], options])
    .exhaustive();

  const {
    all = false,
    reinstallForciblyRemoved = false,
    self = false,
  } = options ?? {};

  const args = all ? ['--all'] : [...packages];

  if (self) {
    // tlmgr for TeX Live 2008 does not have `self` option
    args.push(internals.version > '2008' ? '--self' : 'texlive.infra');
  }

  // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
  if (reinstallForciblyRemoved && internals.version >= '2009') {
    args.unshift('--reinstall-forcibly-removed');
  }

  const action = 'update';

  try {
    return await internals.exec(action, [...args]);
  } catch (cause) {
    if (cause instanceof ExecError) {
      const opts = { action, cause, version: internals.version } as const;
      TlpdbError.checkRepositoryStatus(cause, opts);
      TlpdbError.checkRepositoryHealth(cause, opts);
      TlmgrError.checkOutdated(cause, opts);
      TlmgrError.checkNotSupported(cause, opts);
    }
    throw cause;
  }
}
