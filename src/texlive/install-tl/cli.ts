import { platform } from 'node:os';
import * as path from 'node:path';

import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';

import * as log from '#/log';
import {
  InstallTLError,
  RepositoryVersionIncompatible,
  UnexpectedVersion,
} from '#/texlive/install-tl/errors';
import type { Profile } from '#/texlive/install-tl/profile';
import { ReleaseData } from '#/texlive/releases';
import { PackageChecksumMismatch, TlpdbError, patch } from '#/texlive/tlpkg';
import { Version } from '#/texlive/version';
import { exec, extract } from '#/util';

export interface InstallTLOptions {
  readonly profile: Profile;
  readonly repository: Readonly<URL>;
}

export async function installTL(options: InstallTLOptions): Promise<void> {
  const { isLatest } = ReleaseData.use();
  const { profile } = options;
  const { version } = profile;
  const repository = new URL(options.repository.href);

  const installTLPath = await acquire(options);
  // eslint-disable-next-line unicorn/no-null
  await exec(installTLPath, ['-version'], { stdin: null });

  // `install-tl` of versions prior to 2017 does not support HTTPS, and
  // that of version 2017 supports HTTPS but does not work properly.
  if (version < '2018' && repository.protocol === 'https:') {
    repository.protocol = 'http:';
  }

  const result = await exec(installTLPath, [
    '-profile',
    await profile.open(),
    // Only version 2008 uses `-location` instead of `-repository`.
    version === '2008' ? '-location' : '-repository',
    repository.href,
  ], {
    stdin: null, // eslint-disable-line unicorn/no-null
    ignoreReturnCode: true,
  });

  const errorOptions = { version, repository };
  if (isLatest(version)) {
    RepositoryVersionIncompatible.check(result, errorOptions);
  } else {
    TlpdbError.check(result, errorOptions);
  }
  PackageChecksumMismatch.check(result, errorOptions);
  try {
    result.check();
  } catch (cause) {
    throw new InstallTLError('Failed to install TeX Live', {
      ...errorOptions,
      cause,
    });
  }

  await patch(profile);
}

async function acquire(options: InstallTLOptions): Promise<string> {
  return path.format({
    dir: restoreCache(options) ?? await download(options),
    base: executableName(options.profile.version),
  });
}

/** @internal */
export function restoreCache(options: InstallTLOptions): string | undefined {
  const { profile: { version } } = options;
  const executable = executableName(version);
  try {
    const TEXMFROOT = findTool(executable, version);
    if (TEXMFROOT !== '') {
      log.info('Found in tool cache');
      return TEXMFROOT;
    }
  } catch (error) {
    log.info({ error }, 'Failed to restore %s', executable);
  }
  return undefined;
}

/** @internal */
export async function download(options: InstallTLOptions): Promise<string> {
  const { isLatest } = ReleaseData.use();
  const { profile: { version }, repository } = options;
  const archive = archiveName();
  const executable = executableName(version);

  const url = new URL(archive, repository);
  log.info('Downloading %s from %s', archive, url.href);
  const archivePath = await downloadTool(url.href);

  log.info('Extracting %s from %s', executable, archivePath);
  const TEXMFROOT = await extract(
    archivePath,
    platform() === 'win32' ? 'zip' : 'tgz',
  );
  if (isLatest(version)) {
    try {
      await UnexpectedVersion.check(TEXMFROOT, { version, repository });
    } catch (error) {
      if (
        error instanceof UnexpectedVersion
        && Version.isVersion(error.remoteVersion)
      ) {
        await saveCache(TEXMFROOT, error.remoteVersion);
      }
      throw error;
    }
  }
  await saveCache(TEXMFROOT, version);

  return TEXMFROOT;
}

async function saveCache(TEXMFROOT: string, version: Version): Promise<void> {
  await patch({ TEXMFROOT, version });
  const executable = executableName(version);
  try {
    log.info('Adding to tool cache');
    await cacheDir(TEXMFROOT, executable, version);
  } catch (error) {
    log.info({ error }, 'Failed to cache %s', executable);
  }
}

function executableName(version: Version): string {
  if (platform() !== 'win32') {
    return 'install-tl';
  } else if (version < '2013') {
    return 'install-tl.bat';
  } else {
    return 'install-tl-windows.bat';
  }
}

function archiveName(): string {
  return platform() === 'win32' ? 'install-tl.zip' : 'install-tl-unx.tar.gz';
}
