import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

// prettier-ignore
const VERSIONS = [
                                                  '1996', '1997', '1998', '1999',
  '2000', '2001', '2002', '2003', '2004', '2005', '2006', '2007', '2008', '2009',
  '2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019',
  '2020', '2021',
] as const;

export type Version = typeof VERSIONS[number];

export function isVersion(version: string): version is Version {
  return VERSIONS.includes(version as Version);
}

export const LATEST_VERSION = VERSIONS[VERSIONS.length - 1] as Version;

export async function install(
  version: Version,
  prefix: string,
  platform: NodeJS.Platform = os.platform(),
): Promise<void> {
  /**
   * - There is no `install-tl` for versions prior to 2005, and
   *   versions 2005--2007 do not seem to be archived.
   *
   * - Versions 2008--2012 can be installed on `macos-latest`, but
   *   do not work properly because the `kpsewhich aborts with "Bad CPU type."
   */
  if (Number(version) < (platform === 'darwin' ? 2013 : 2008)) {
    throw new Error(
      `Installation of TeX Live ${version} on ${platform} is not supported`,
    );
  }
  return new InstallTL(version, prefix, platform).run();
}

export interface Texmf {
  readonly texdir: string;
  readonly local: string;
  readonly sysconfig: string;
  readonly sysvar: string;
}

export class Manager {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  conf(): Texmf {
    const texdir = path.join(this.prefix, this.version);
    const local = path.join(this.prefix, 'texmf-local');
    const sysconfig = path.join(texdir, 'texmf-config');
    const sysvar = path.join(texdir, 'texmf-var');
    return { texdir, local, sysconfig, sysvar };
  }

  async install(packages: Array<string>): Promise<void> {
    if (packages.length !== 0) {
      await exec.exec('tlmgr', ['install', ...packages]);
    }
  }

  /**
   * @todo `install-tl -print-platform` and `tlmgr print-platform` may be useful
   */
  async pathAdd(): Promise<void> {
    const matched = await expand(
      path.join(this.prefix, this.version, 'bin', '*'),
    );
    if (matched.length !== 1) {
      core.debug(`Matched: ${matched}`);
      throw new Error('Unable to locate the bin directory');
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    core.addPath(matched[0]!);
  }
}

function repository(version: Version): URL {
  const base =
    version === LATEST_VERSION
      ? 'https://mirror.ctan.org/systems/texlive/'
      : `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`;
  const tlnet = `tlnet${
    Number(version) < 2010 || version === LATEST_VERSION ? '' : '-final'
  }/`;
  const url = new URL(tlnet, base);
  /**
   * `install-tl` of versions prior to 2017 does not support HTTPS, and
   * that of version 2017 supports HTTPS but does not work properly.
   */
  if (Number(version) < 2018) {
    url.protocol = 'http';
  }
  return url;
}

class InstallTL {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
    private readonly platform: NodeJS.Platform,
  ) {}

  async run(): Promise<void> {
    const installtl = path.join(
      await this.#download(),
      InstallTL.executable(this.version, this.platform),
    );
    const env = { ...process.env, TEXLIVE_INSTALL_ENV_NOCHECK: '1' };
    const options = ['-no-gui', '-profile', await this.#profile()];

    if (this.version !== LATEST_VERSION) {
      options.push(
        /**
         * Only version 2008 uses `-location` instead of `-repository`.
         */
        this.version === '2008' ? '-location' : '-repository',
        repository(this.version).href,
      );
    }

    await core.group('Installing TeX Live', async () => {
      await exec.exec(installtl, options, { env });
      const tlmgr = new Manager(this.version, this.prefix);
      core.info('Applying patches');
      await patch(this.version, this.platform, tlmgr.conf().texdir);
      await tlmgr.pathAdd();
    });
  }

  async #download(): Promise<string> {
    const target = `install-tl${
      this.platform === 'win32' ? '.zip' : '-unx.tar.gz'
    }`;
    return core.group(`Acquiring ${target}`, async () => {
      try {
        const cache = tool.find(target, this.version);
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

      const url = new URL(target, repository(this.version)).href;
      core.info(`Downloading ${url}`);
      const archive = await tool.downloadTool(url);

      core.info('Extracting');
      let dest: string;

      if (this.platform === 'win32') {
        const matched = await expand(
          path.join(await tool.extractZip(archive), 'install-tl*'),
        );
        if (matched.length !== 1) {
          core.debug(`Matched: ${matched}`);
          throw new Error('Unable to locate the installer path');
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        dest = matched[0]!;
      } else {
        dest = await tool.extractTar(archive, undefined, ['xz', '--strip=1']);
      }

      core.info('Applying patches');
      await patch(this.version, this.platform, dest);

      try {
        core.info('Adding to the cache');
        await tool.cacheDir(dest, target, this.version);
      } catch (error) {
        core.info(`Failed to add to cache: ${error}`);
        if (error instanceof Error && error.stack !== undefined) {
          core.debug(error.stack);
        }
      }

      return dest;
    });
  }

  async #profile(): Promise<string> {
    const texmf = new Manager(this.version, this.prefix).conf();
    const adjustrepo = this.version === LATEST_VERSION ? 1 : 0;
    /**
     * `scheme-infraonly` was first introduced in TeX Live 2016.
     */
    const scheme = Number(this.version) < 2016 ? 'minimal' : 'infraonly';
    const profile = [
      `TEXDIR ${texmf.texdir}`,
      `TEXMFLOCAL ${texmf.local}`,
      `TEXMFSYSCONFIG ${texmf.sysconfig}`,
      `TEXMFSYSVAR ${texmf.sysvar}`,
      `selected_scheme scheme-${scheme}`,
      `option_adjustrepo ${adjustrepo}`,
      'option_autobackup 0',
      'option_desktop_integration 0',
      'option_doc 0',
      'option_file_assocs 0',
      'option_menu_integration 0',
      'option_src 0',
      'option_w32_multi_user 0',
    ].join('\n');

    core.group('Profile', async () => core.info(profile));

    const dest = path.join(
      await fs.mkdtemp(
        path.join(process.env['RUNNER_TEMP'] ?? os.tmpdir(), 'setup-texlive-'),
      ),
      'texlive.profile',
    );
    await fs.writeFile(dest, profile);
    core.debug(`${dest} created`);
    return dest;
  }

  static executable(version: Version, platform: NodeJS.Platform): string {
    const ext = `${Number(version) > 2012 ? '-windows' : ''}.bat`;
    return `install-tl${platform === 'win32' ? ext : ''}`;
  }
}

async function patch(
  version: Version,
  platform: NodeJS.Platform,
  texdir: string,
): Promise<void> {
  const update = async (filename: string, map: (content: string) => string) => {
    return fs.writeFile(filename, map(await fs.readFile(filename, 'utf8')));
  };
  /**
   * Prevent `install-tl(-windows).bat` from being stopped by `pause`.
   */
  if (platform === 'win32') {
    try {
      await update(
        path.join(texdir, InstallTL.executable(version, platform)),
        (content) => content.replace(/\bpause(?: Done)?\b/gm, ''),
      );
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any)?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  /**
   * Fix a syntax error in `tlpkg/TeXLive/TLWinGoo.pm`.
   */
  if (['2009', '2010'].includes(version)) {
    await update(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLWinGoo.pm'),
      (content) => {
        return content.replace(
          /foreach \$p qw\((.*)\)/,
          'foreach $$p (qw($1))',
        );
      },
    );
  }
  /**
   * Define Code Page 65001 as an alias for UTF-8 on Windows.
   * @see {@link https://github.com/dankogai/p5-encode/issues/37}
   */
  if (platform === 'win32' && version === '2015') {
    await update(
      path.join(texdir, 'tlpkg', 'tlperl', 'lib', 'Encode', 'Alias.pm'),
      (content) => {
        return content.replace(
          '# utf8 is blessed :)',
          `define_alias(qr/cp65001/i => '"utf-8-strict"');`,
        );
      },
    );
  }
  /**
   * Make it possible to use `\` as a directory separator on Windows.
   */
  if (platform === 'win32' && Number(version) < 2019) {
    await update(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      (content) => {
        return content.replace(
          String.raw`split (/\//, $tree)`,
          String.raw`split (/[\/\\]/, $tree)`,
        );
      },
    );
  }
  /**
   * Add support for macOS 11.x.
   */
  if (platform === 'darwin' && ['2017', '2018', '2019'].includes(version)) {
    await update(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      (content) => {
        return content
          .replace(
            // prettier-ignore
            'if ($os_major != 10)',
            'if ($$os_major < 10)',
          )
          .replace(
            'if ($os_minor >= $mactex_darwin)',
            'if ($$os_major >= 11) { $$CPU = "x86_64"; $$OS = "darwin"; } els$&',
          );
      },
    );
  }
}

async function expand(pattern: string): Promise<Array<string>> {
  return (await glob.create(pattern, { implicitDescendants: false })).glob();
}
