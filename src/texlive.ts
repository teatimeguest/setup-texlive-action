import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

// prettier-ignore
const VERSIONS = [
  '2019',
  '2020',
  '2021',
] as const;

export type Version = typeof VERSIONS[number];

export function isVersion(version: string): version is Version {
  return VERSIONS.includes(version as Version);
}

export const LATEST_VERSION: Version = '2021';

export async function install(
  version: Version,
  prefix: string,
  platform: NodeJS.Platform,
): Promise<void> {
  const installer = path.join(
    await download(version, platform),
    `install-tl${platform === 'win32' ? '-windows' : ''}`,
  );
  const profile = await createProfile(version, prefix);
  const env = { ...process.env, TEXLIVE_INSTALL_ENV_NOCHECK: '1' };
  const options = ['-no-gui', '-profile', profile];

  if (version !== LATEST_VERSION) {
    options.push('-repository', repository(version).toString());
  }

  await core.group('Installing TeX Live', async () => {
    await exec.exec(installer, options, { env });
    const tlmgr = new Manager(version, prefix);
    await tlmgr.pathAdd();
  });
}

export interface Texmf {
  readonly texdir: string;
  readonly local: string;
  readonly sysconfig: string;
  readonly sysvar: string;
}

export class Manager {
  constructor(readonly version: Version, readonly prefix: string) {}

  conf(): Texmf {
    const texdir = path.join(this.prefix, this.version);
    const local = path.join(this.prefix, 'texmf-local');
    const sysconfig = path.join(texdir, 'texmf-config');
    const sysvar = path.join(texdir, 'texmf-var');
    return { texdir, local, sysconfig, sysvar };
  }

  async install(packages: Array<string>): Promise<void> {
    if (packages.length === 0) {
      return;
    }
    await exec.exec('tlmgr', ['install', ...packages]);
  }

  /**
   * @todo `install-tl -print-platform` and `tlmgr print-platform` may be useful
   */
  async pathAdd(): Promise<void> {
    const bin = await determine(
      path.join(this.prefix, this.version, 'bin', '*'),
    );
    if (bin === undefined) {
      throw new Error('Unable to locate the bin directory');
    }
    core.addPath(bin);
  }
}

/**
 * Returns the only file path that matches the given glob pattern.
 * If it is not uniquely determined, it returns `undefined`.
 *
 * @param pattern - A glob pattern
 * @returns - The path of the matched file or directory
 */
async function determine(pattern: string): Promise<string | undefined> {
  const globber = await glob.create(pattern, { implicitDescendants: false });
  const matched = await globber.glob();
  return matched.length === 1 ? matched[0] : undefined;
}

function repository(version: Version): URL {
  return new URL(
    version === LATEST_VERSION
      ? 'https://mirror.ctan.org/systems/texlive/tlnet/'
      : `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/tlnet-final/`,
  );
}

async function download(
  version: Version,
  platform: NodeJS.Platform,
): Promise<string> {
  const filename = `install-tl${platform === 'win32' ? '.zip' : '-unx.tar.gz'}`;

  return core.group(`Arquiring ${filename}`, async () => {
    try {
      const cache = tool.find(filename, version);
      if (cache !== '') {
        core.info('Found in cache');
        return cache;
      }
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    const url = `${repository(version)}${filename}`;
    core.info(`Downloading ${url}`);
    const archive = await tool.downloadTool(url);

    core.info('Extracting');
    let dest: string;

    if (platform === 'win32') {
      const sub = await determine(
        path.join(await tool.extractZip(archive), 'install-tl-*'),
      );
      if (sub === undefined) {
        throw new Error('Unable to locate the installer path');
      }
      dest = sub;
    } else {
      const options = ['xz', '--strip=1'];
      dest = await tool.extractTar(archive, undefined, options);
    }

    try {
      core.info(`Adding to the cache`);
      await tool.cacheDir(dest, filename, version);
    } catch (error) {
      core.info(`Failed to add to cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    return dest;
  });
}

async function createProfile(
  version: Version,
  prefix: string,
): Promise<string> {
  const tlmgr = new Manager(version, prefix);
  const texmf = tlmgr.conf();
  const adjustrepo = version === LATEST_VERSION ? 1 : 0;

  const profile = `
    TEXDIR ${texmf.texdir}
    TEXMFLOCAL ${texmf.local}
    TEXMFSYSCONFIG ${texmf.sysconfig}
    TEXMFSYSVAR ${texmf.sysvar}
    selected_scheme scheme-infraonly
    instopt_adjustrepo ${adjustrepo}
    tlpdbopt_autobackup 0
    tlpdbopt_desktop_integration 0
    tlpdbopt_file_assocs 0
    tlpdbopt_install_docfiles 0
    tlpdbopt_install_srcfiles 0
    tlpdbopt_w32_multi_user 0
  `
    .trim()
    .split(/\n\s*/)
    .join('\n');

  core.startGroup('Profile');
  core.info(profile);
  core.endGroup();

  const tmp = process.env['RUNNER_TEMP'] ?? os.tmpdir();
  const dest = path.join(
    await fs.mkdtemp(path.join(tmp, 'setup-texlive-')),
    'texlive.profile',
  );
  await fs.writeFile(dest, profile);
  core.debug(`${dest} created`);

  return dest;
}
