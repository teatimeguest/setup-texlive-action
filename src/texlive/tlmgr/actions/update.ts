import { TLVersionOutdated } from '#/texlive/tlmgr/errors';
import { use } from '#/texlive/tlmgr/internals';
import { ExecError, processArgsAndOptions } from '#/util/exec';

export interface UpdateOptions {
  readonly all?: boolean;
  readonly self?: boolean;
  readonly reinstallForciblyRemoved?: boolean;
}

export function update(options?: UpdateOptions): Promise<void>;
export function update(
  packages: Iterable<string>,
  options?: UpdateOptions,
): Promise<void>;

export async function update(
  packagesOrOptions?: Iterable<string> | UpdateOptions,
  options?: UpdateOptions,
): Promise<void> {
  const internals = use();
  let packages: Iterable<string>;
  [packages = [], options] = processArgsAndOptions(
    packagesOrOptions,
    options,
  );
  const args = (options?.all ?? false) ? ['--all'] : [...packages];
  if (options?.self ?? false) {
    // tlmgr for TeX Live 2008 does not have `self` option
    args.push(internals.version > '2008' ? '--self' : 'texlive.infra');
  }
  if (
    (options?.reinstallForciblyRemoved ?? false)
    // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
    && internals.version >= '2009'
  ) {
    args.unshift('--reinstall-forcibly-removed');
  }
  const action = 'update';
  try {
    await internals.exec(action, [...args]);
  } catch (cause) {
    if (cause instanceof ExecError) {
      TLVersionOutdated.check(cause, {
        action,
        cause,
        version: internals.version,
      });
    }
    throw cause;
  }
}
