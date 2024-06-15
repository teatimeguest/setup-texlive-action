import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import * as path from 'node:path';

import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';
import * as log from '@setup-texlive-action/logger';
import { exec, extract } from '@setup-texlive-action/utils';
import { Range } from 'semver';

import { type TLErrorOptions } from '#texlive/errors';
import { InstallTLError } from '#texlive/install-tl/errors';
import type { Profile } from '#texlive/install-tl/profile';
import { TlpdbError, patch } from '#texlive/tlpkg';
import { Version } from '#texlive/version';

export interface InstallTLOptions {
  readonly profile: Profile;
  readonly repository: Readonly<URL>;
}

export class InstallTL {
  constructor(readonly directory: string, readonly version: Version) {}

  async run(options: InstallTLOptions): Promise<void> {
    const { profile, repository } = options;

    const installTL = path.format({
      dir: this.directory,
      base: executableName(this.version),
    });
    await exec(installTL, ['-version'], { stdin: null });

    const result = await exec(
      installTL,
      await Array.fromAsync(commandArgs(options)),
      { stdin: null, ignoreReturnCode: true },
    );

    const errorOptions = { version: this.version, repository };

    InstallTLError.checkCompatibility(result, errorOptions);
    TlpdbError.checkRepositoryStatus(result, errorOptions);
    TlpdbError.checkRepositoryHealth(result, errorOptions);
    TlpdbError.checkPackageChecksumMismatch(result, errorOptions);

    try {
      result.check();
    } catch (cause) {
      throw new InstallTLError('Failed to install TeX Live', {
        ...errorOptions,
        cause,
      });
    }

    await patch({ directory: this.directory, version: profile.version });
  }
}

const supportVersions = {
  options: {
    ['-repository']: new Range('>=2009'),
    ['-no-continue']: new Range('>=2022'),
    ['-no-interaction']: new Range('>=2023'),
  },
  protocol: {
    /**
     * @remarks
     * Versions prior to 2017 does not support HTTPS, and
     * version 2017 supports HTTPS but does not work properly.
     */
    ['https:']: new Range('>=2018'),
  },
} as const;

async function* commandArgs(
  options: InstallTLOptions,
): AsyncGenerator<string, void, void> {
  const version = options.profile.version;

  for (const option of ['-no-continue', '-no-interaction'] as const) {
    if (Version.satisfies(version, supportVersions.options[option])) {
      yield option;
    }
  }

  yield* ['-profile', await options.profile.open()];

  const repository = new URL(options.repository.href);
  if (
    repository.protocol === 'https:'
    && !Version.satisfies(version, supportVersions.protocol['https:'])
  ) {
    repository.protocol = 'http:';
  }
  yield* [
    Version.satisfies(version, supportVersions.options['-repository'])
      ? '-repository'
      : '-location',
    repository.href,
  ];
}

export interface DownloadOptions {
  readonly version?: Version | undefined;
  readonly repository: Readonly<URL>;
}

export async function acquire(options: DownloadOptions): Promise<InstallTL> {
  const { version, repository } = options;
  if (version !== undefined) {
    const dir = restoreCache(version);
    if (dir !== undefined) {
      return new InstallTL(dir, version);
    }
  }
  const dir = await download(repository);
  const remoteVersion = await checkVersion(dir);
  await saveCache(dir, remoteVersion);
  if (version !== undefined && version !== remoteVersion) {
    throw new InstallTLError(
      `Unexpected install-tl version: ${remoteVersion}`,
      { repository, version, remoteVersion },
    );
  }
  return new InstallTL(dir, remoteVersion);
}

const RELEASE_TEXT_FILE = 'release-texlive.txt';
const RE = /^TeX Live .+ version (20\d{2})/v;

async function checkVersion(dir: string): Promise<Version> {
  const opts: TLErrorOptions = {
    code: InstallTLError.Code.UNEXPECTED_VERSION,
  };
  try {
    const releaseTxt = path.format({ dir, name: RELEASE_TEXT_FILE });
    opts.remoteVersion = RE.exec(await readFile(releaseTxt, 'utf8'))?.[1];
    return Version.parse(opts.remoteVersion!);
  } catch (cause) {
    opts.cause = cause;
  }
  throw new InstallTLError(
    `Unexpected install-tl version: ${opts.remoteVersion ?? 'unknown'}`,
    opts,
  );
}

/** @internal */
export function restoreCache(version: Version): string | undefined {
  const executable = executableName(version);
  try {
    const dir = findTool(executable, version);
    if (dir !== '') {
      log.info('Found in tool cache: %s', dir);
      return dir;
    }
  } catch (error) {
    log.info({ error }, 'Failed to restore %s', executable);
  }
  return undefined;
}

/** @internal */
export async function download(repository: Readonly<URL>): Promise<string> {
  const errorOpts = {
    repository,
    code: InstallTLError.Code.FAILED_TO_DOWNLOAD,
  };

  if (repository.protocol === 'ftp:') {
    throw new InstallTLError(
      'Download from FTP repositories is currently not supported',
      errorOpts,
    );
  }

  const archive = archiveName();

  const url = new URL(archive, repository);
  log.info('Downloading %s from %s', archive, url.href);
  let archivePath: string;
  try {
    archivePath = await downloadTool(url.href);
  } catch (cause) {
    const error = new InstallTLError('Failed to download install-tl', {
      ...errorOpts,
      cause,
    });
    throw error;
  }

  log.info('Extracting install-tl from %s', archivePath);
  return await extract(
    archivePath,
    platform() === 'win32' ? 'zip' : 'tgz',
  );
}

async function saveCache(directory: string, version: Version): Promise<void> {
  await patch({ directory, version });
  const executable = executableName(version);
  try {
    log.info('Adding to tool cache');
    await cacheDir(directory, executable, version);
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

/* eslint unicorn/no-null: off */
