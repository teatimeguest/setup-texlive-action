import { Buffer } from 'node:buffer';
import { platform } from 'node:os';
import path from 'node:path';

import { exec, getExecOutput } from '@actions/exec';
import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';

import * as log from '#/log';
import type { Profile } from '#/texlive/profile';
import * as tlnet from '#/texlive/tlnet';
import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';
import { extract } from '#/utility';

// Prevents `install-tl(-windows).bat` from being stopped by `pause`.
const devNull: Buffer = Buffer.alloc(0);

export async function installTL(profile: Profile): Promise<void> {
  const dir = restore(profile.version) ?? await download(profile.version);
  const installer = path.join(dir, executable(profile.version));
  // Print version info.
  await exec(installer, ['-version'], { input: devNull });

  for await (const dest of profile.open()) {
    const options = ['-profile', dest];
    if (!profile.version.isLatest()) {
      const repo = tlnet.historic(profile.version);
      // `install-tl` of versions prior to 2017 does not support HTTPS, and
      // that of version 2017 supports HTTPS but does not work properly.
      if (profile.version.number < 2018) {
        repo.protocol = 'http';
      }
      options.push(
        // Only version 2008 uses `-location` instead of `-repository`.
        profile.version.number === 2008 ? '-location' : '-repository',
        repo.href,
      );
    }
    tlpkg.check(await getExecOutput(installer, options, { input: devNull }));
  }

  await tlpkg.patch(profile);
}

export function restore(version: Version): string | undefined {
  let dest = '';
  try {
    dest = findTool(executable(version), version.toString());
  } catch (cause) {
    log.info('Failed to restore installer', { cause });
  }
  if (dest === '') {
    return undefined;
  } else {
    log.info('Found in tool cache');
    return dest;
  }
}

export async function download(version: Version): Promise<string> {
  const { href } = url(version);
  log.info(`Downloading ${href}`);
  const archive = await downloadTool(href);

  log.info(`Extracting installer from ${archive}`);
  const dest = await extract(archive, platform() === 'win32' ? 'zip' : 'tgz');
  await tlpkg.patch({ TEXDIR: dest, version });

  try {
    log.info('Adding to tool cache');
    await cacheDir(dest, executable(version), version.toString());
  } catch (cause) {
    log.info('Failed to cache installer', { cause });
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

function url(version: Version): URL {
  return new URL(
    platform() === 'win32' ? 'install-tl.zip' : 'install-tl-unx.tar.gz',
    version.isLatest() ? tlnet.CTAN : tlnet.historic(version),
  );
}
