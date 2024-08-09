import { setTimeout } from 'node:timers/promises';

import { toTL } from '@setup-texlive-action/data/package-names.json';
import * as log from '@setup-texlive-action/logger';
import { SetMultimap } from '@teppeis/multimaps';

import * as ctan from '#texlive/ctan';
import { PackageNotFound } from '#texlive/tlmgr/errors';
import { use } from '#texlive/tlmgr/internals';
import { TlpdbError } from '#texlive/tlpkg';

export async function install(packages: Iterable<string>): Promise<void> {
  try {
    await tryToInstall(new Set(packages));
  } catch (error) {
    if (!(error instanceof PackageNotFound)) {
      throw error;
    }
    // Some packages have different names in TeX Live and CTAN, and
    // the DEPENDS.txt format requires a CTAN name, while
    // `tlmgr install` requires a TeX Live one.
    // To get the correct names for those packages,
    // the action first looks up the pre-generated dictionary and
    // then falls back to the CTAN API.
    log.info(
      'Looking up the correct package name(s):',
      error.packages.join(', '),
    );
    let rest: ReadonlySet<string> | undefined = new Set(error.packages);
    rest = await tryToInstallWith(rest, async (name) => {
      return (toTL as Record<string, string | string[] | undefined>)[name];
    });
    if (rest !== undefined && rest.size > 0) {
      log.info('Querying CTAN:', [...rest].join(', '));
      rest = await tryToInstallWith(rest, async (name) => {
        try {
          const pkg = await ctan.api.pkg(name);
          if (typeof pkg.texlive === 'string') {
            return pkg.texlive;
          }
        } catch (error) { // eslint-disable-line @typescript-eslint/no-shadow
          log.info({ error }, 'Failed to request package data');
        } finally {
          await setTimeout(200); // 200ms
        }
        return undefined;
      });
      if (rest !== undefined && rest.size > 0) {
        throw new PackageNotFound([...rest], { action: 'install' });
      }
    }
  }
}

async function tryToInstallWith(
  packages: ReadonlySet<string>,
  lookup: (name: string) => Promise<string | string[] | undefined>,
): Promise<ReadonlySet<string> | undefined> {
  const fromTL = new SetMultimap<string, string>();
  const notFound: string[] = [];
  for (const name of packages) {
    // eslint-disable-next-line no-await-in-loop
    let tlnames = await lookup(name.toLowerCase().split('.', 1)[0] ?? name);
    if (tlnames === undefined) {
      notFound.push(name);
    } else {
      tlnames = Array.isArray(tlnames) ? tlnames : [tlnames];
      for (const tlname of tlnames) {
        fromTL.put(tlname, name);
      }
      log.info('  %s (in CTAN) => %s (in TeX Live)', name, tlnames.join(', '));
    }
  }
  if (fromTL.size === 0) {
    return packages;
  }
  try {
    await tryToInstall(new Set(fromTL.keys()));
  } catch (error) {
    if (!(error instanceof PackageNotFound)) {
      throw error;
    }
    // This may be a failure to parse logs.
    if (error.packages.some((tlname) => !fromTL.has(tlname))) {
      log.debug('Unexpected result: %o', fromTL.asMap());
      return packages;
    }
    notFound.push(...error.packages.flatMap((name) => [...fromTL.get(name)]));
    return new Set(notFound);
  }
  return undefined;
}

async function tryToInstall(packages: ReadonlySet<string>): Promise<void> {
  if (packages.size > 0) {
    const internals = use();
    const action = 'install';
    const result = await internals.exec(action, packages, {
      ignoreReturnCode: true,
    });
    TlpdbError.checkPackageChecksumMismatch(result);
    // Missing packages is not an error in versions prior to 2015,
    // so a non-zero status code indicates a more severe error has occurred.
    if (internals.version < '2015') {
      result.check();
    }
    PackageNotFound.check(result, { action, version: internals.version });
    if (internals.version >= '2015') {
      result.check();
    }
  }
}
