import { platform } from 'node:os';
import path from 'node:path';

import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';

import * as log from '#/log';
import type { Profile } from '#/texlive/profile';
import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';
import { type ExecResult, exec, extract } from '#/util';

export interface InstallTLOptions {
  readonly profile: Profile;
  readonly repository: Readonly<URL>;
}

export async function installTL(options: InstallTLOptions): Promise<void> {
  const { profile } = options;
  const repository = new URL(options.repository.href);
  const { version } = profile;

  const installTLPath = path.format({
    dir: restore(version) ?? await download({ repository, version }),
    base: executable(version),
  });
  // Print version info.
  // eslint-disable-next-line unicorn/no-null
  await exec(installTLPath, ['-version'], { stdin: null });

  // `install-tl` of versions prior to 2017 does not support HTTPS, and
  // that of version 2017 supports HTTPS but does not work properly.
  if (version.number < 2018 && repository.protocol === 'https:') {
    repository.protocol = 'http:';
  }

  for await (const profilePath of profile.open()) {
    const result = await exec(installTLPath, [
      '-profile',
      profilePath,
      // Only version 2008 uses `-location` instead of `-repository`.
      version.number === 2008 ? '-location' : '-repository',
      repository.href,
    ], {
      stdin: null, // eslint-disable-line unicorn/no-null
      ignoreReturnCode: true,
    });
    check(result);
  }

  await tlpkg.patch(profile);
}

function check(result: ExecResult): void {
  if (
    result.stderr.includes('the repository being accessed are not compatible')
  ) {
    throw new Error(
      'It seems that the CTAN mirrors have not completed synchronisation'
        + ' against a release of new version of TeX Live.'
        + ' Please try re-running the workflow after some time.',
    );
  }
  result.check();
  tlpkg.check(result);
}

export function restore(version: Version): string | undefined {
  let dest = '';
  try {
    dest = findTool(executable(version), version.toString());
  } catch (cause) {
    log.info(`Failed to restore ${executable(version)}`, { cause });
  }
  if (dest === '') {
    return undefined;
  } else {
    log.info('Found in tool cache');
    return dest;
  }
}

export async function download(options: {
  readonly repository: Readonly<URL>;
  readonly version: Version;
}): Promise<string> {
  const { repository, version } = options;
  const name = archiveName();
  const url = new URL(name, repository);
  log.info(`Downloading ${name} from ${repository}`);
  const archive = await downloadTool(url.href);

  log.info(`Extracting ${executable(version)} from ${archive}`);
  const dest = await extract(archive, platform() === 'win32' ? 'zip' : 'tgz');
  await tlpkg.patch({ TEXDIR: dest, version });

  try {
    log.info('Adding to tool cache');
    await cacheDir(dest, executable(version), version.toString());
  } catch (cause) {
    log.info(`Failed to cache ${executable(version)}`, { cause });
  }

  return dest;
}

function executable({ number: version }: Version): string {
  if (platform() !== 'win32') {
    return 'install-tl';
  } else if (version < 2013) {
    return 'install-tl.bat';
  } else {
    return 'install-tl-windows.bat';
  }
}

function archiveName(): string {
  return platform() === 'win32' ? 'install-tl.zip' : 'install-tl-unx.tar.gz';
}
