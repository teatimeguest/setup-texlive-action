import * as log from '@setup-texlive-action/logger';

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
    // To install such packages with tlmgr,
    // the action uses the CTAN API to look up their names in TeX Live.
    log.info('Trying to resolve package names: ', error.packages.join(', '));
    const result = await Promise.all(error.packages.map((name) => {
      return resolvePackageName(name);
    }));
    const notFound = [] as string[];
    const resolved = new Set<string>();
    for (const [ctanName, tlName] of result) {
      if (tlName !== undefined) {
        resolved.add(tlName);
      } else {
        notFound.push(ctanName);
      }
      log.info('  %s (in CTAN) => %s (in TeX Live)', ctanName, tlName ?? '???');
    }
    if (notFound.length > 0) {
      throw new PackageNotFound(notFound, { action: 'install' });
    }
    await tryToInstall(resolved);
  }
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

async function resolvePackageName(
  name: string,
): Promise<[ctanName: string, tlName?: string]> {
  try {
    const pkg = await ctan.api.pkg(name);
    if (pkg.texlive !== undefined) {
      return [name, pkg.texlive];
    }
    log.info('Unexpected response: %j', pkg);
  } catch (error) {
    log.info({ error }, 'Failed to request package data');
  }
  return [name];
}
