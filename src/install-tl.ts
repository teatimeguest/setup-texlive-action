import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { types } from 'util';
import { URL } from 'url';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';

import * as tl from '#/texlive';
import * as util from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: tl.Version,
    private readonly bin: string,
  ) {}

  async run(
    profile: Readonly<Profile>,
    env: Readonly<Environment> = Environment.get(this.version),
  ): Promise<void> {
    const options = ['-no-gui', '-profile', await profile.write()];

    if (this.version !== tl.LATEST_VERSION) {
      options.push(
        /**
         * Only version 2008 uses `-location` instead of `-repository`.
         */
        this.version === '2008' ? '-location' : '-repository',
        repository(this.version).href,
      );
    }

    await exec.exec(this.bin, options, {
      // This coercion is necessary; otherwise `tsc` would complain that
      // "Property 'toString' is incompatible with index signature.'
      env: { ...process.env, ...(env as Environment) },
    });
    core.info('Applying patches');
    await patch(this.version, profile.TEXDIR);
  }

  static async download(version: tl.Version): Promise<InstallTL> {
    /**
     * - There is no `install-tl` for versions prior to 2005, and
     *   versions 2005--2007 do not seem to be archived.
     *
     * - Versions 2008--2012 can be installed on `macos-latest`, but
     *   do not work properly because the `kpsewhich aborts with "Bad CPU type."
     */
    if (Number(version) < (os.platform() === 'darwin' ? 2013 : 2008)) {
      throw new RangeError(
        `Installation of TeX Live ${version} on ${os.platform()} is not supported`,
      );
    }

    const target = `install-tl${
      os.platform() === 'win32' ? '.zip' : '-unx.tar.gz'
    }`;

    try {
      const cache = tool.find(target, version);
      if (cache !== '') {
        core.info('Found in cache');
        return new InstallTL(
          version,
          path.join(cache, executable(version, os.platform())),
        );
      }
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    const url = new URL(target, repository(version)).href;
    core.info(`Downloading ${url}`);
    const archive = await tool.downloadTool(url);

    core.info('Extracting');
    const dest = await util.extract(
      archive,
      os.platform() === 'win32' ? 'zip' : 'tar.gz',
    );

    core.info('Applying patches');
    await patch(version, dest);

    try {
      core.info('Adding to the cache');
      await tool.cacheDir(dest, target, version);
    } catch (error) {
      core.info(`Failed to add to cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }

    return new InstallTL(
      version,
      path.join(dest, executable(version, os.platform())),
    );
  }
}

export class Environment
  implements
    Partial<
      Readonly<Record<ReturnType<typeof Environment.keys>[number], string>>
    >
{
  /* eslint-disable @typescript-eslint/naming-convention */
  readonly TEXLIVE_DOWNLOADER?: string;
  readonly TL_DOWNLOAD_PROGRAM?: string;
  readonly TL_DOWNLOAD_ARGS?: string;
  readonly TEXLIVE_INSTALL_ENV_NOCHECK: string;
  readonly TEXLIVE_INSTALL_NO_CONTEXT_CACHE?: string;
  readonly TEXLIVE_INSTALL_NO_RESUME?: string;
  readonly TEXLIVE_INSTALL_NO_WELCOME: string;
  readonly TEXLIVE_INSTALL_PAPER?: string;
  readonly TEXLIVE_INSTALL_PREFIX: string;
  readonly TEXLIVE_INSTALL_TEXMFHOME: string;
  readonly TEXLIVE_INSTALL_TEXMFCONFIG: string;
  readonly TEXLIVE_INSTALL_TEXMFVAR: string;
  readonly NOPERLDOC?: string;
  /* eslint-enable @typescript-eslint/naming-convention */

  private constructor(version: tl.Version) {
    for (const key of Environment.keys()) {
      const value = process.env[key];
      if (value !== undefined) {
        this[key] = value;
      }
    }
    const home = os.homedir();
    const texdir = path.join(home, '.local', 'texlive', version);
    this.TEXLIVE_INSTALL_ENV_NOCHECK ??= 'true';
    this.TEXLIVE_INSTALL_NO_WELCOME ??= 'true';
    this.TEXLIVE_INSTALL_PREFIX ??= path.join(util.tmpdir(), 'setup-texlive');
    this.TEXLIVE_INSTALL_TEXMFHOME ??= path.join(home, 'texmf');
    this.TEXLIVE_INSTALL_TEXMFCONFIG ??= path.join(texdir, 'texmf-config');
    this.TEXLIVE_INSTALL_TEXMFVAR ??= path.join(texdir, 'texmf-var');
  }

  toString(): string {
    return Environment.keys()
      .map((key) => {
        return `${key}='${this[key] ?? ''}'`;
      })
      .join('\n');
  }

  static get(version: tl.Version): Environment {
    return new Environment(version);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  static keys() {
    return [
      'TEXLIVE_DOWNLOADER',
      'TL_DOWNLOAD_PROGRAM',
      'TL_DOWNLOAD_ARGS',
      'TEXLIVE_INSTALL_ENV_NOCHECK',
      'TEXLIVE_INSTALL_NO_CONTEXT_CACHE',
      'TEXLIVE_INSTALL_NO_RESUME',
      'TEXLIVE_INSTALL_NO_WELCOME',
      'TEXLIVE_INSTALL_PAPER',
      'TEXLIVE_INSTALL_PREFIX',
      'TEXLIVE_INSTALL_TEXMFHOME',
      'TEXLIVE_INSTALL_TEXMFCONFIG',
      'TEXLIVE_INSTALL_TEXMFVAR',
      'NOPERLDOC',
    ] as const;
  }
}

export class Profile
  implements Readonly<Record<ReturnType<typeof Profile.keys>[number], string>>
{
  constructor(
    private readonly version: tl.Version,
    private readonly prefix: string,
  ) {}

  /* eslint-disable @typescript-eslint/naming-convention */
  /**
   * - `option_autobackup`, `option_doc`, `option_src`, and `option_symlinks`
   *   already exist since version 2008.
   *
   * - In version 2009, `option_desktop_integration`, `option_file_assocs`,
   *   and `option_w32_multi_user` were first introduced.
   *   Also, `option_symlinks` was renamed to `option_path`.
   *
   * - `option_adjustrepo` was first introduced in version 2011.
   *
   * - `option_menu_integration` was first introduced in version 2012 and
   *   removed in version 2017.
   *
   * - In version 2017, the option names have been changed, and
   *   new prefixes `instopt-` and `tlpdbopt-` have been introduced.
   *   Also, `option_path` and `option_symlinks` have been merged and
   *   `instopt_adjustpath` has been introduced.
   *   The old option names are still valid in later versions.
   */
  readonly TEXDIR: string = path.join(this.prefix, this.version);
  readonly TEXMFLOCAL: string = path.join(this.prefix, 'texmf-local');
  readonly TEXMFSYSCONFIG: string = path.join(this.TEXDIR, 'texmf-config');
  readonly TEXMFSYSVAR: string = path.join(this.TEXDIR, 'texmf-var');
  /**
   * `scheme-infraonly` was first introduced in TeX Live 2016.
   */
  readonly selected_scheme: string = `scheme-${
    Number(this.version) < 2016 ? 'minimal' : 'infraonly'
  }`;
  readonly option_adjustrepo: string =
    this.version === tl.LATEST_VERSION ? '1' : '0';
  readonly option_autobackup: string = '0';
  readonly option_desktop_integration: string = '0';
  readonly option_doc: string = '0';
  readonly option_file_assocs: string = '0';
  readonly option_menu_integration: string = '0';
  readonly option_path: string = '0';
  readonly option_src: string = '0';
  readonly option_symlinks: string = '0';
  readonly option_w32_multi_user: string = '0';
  /* eslint-enable @typescript-eslint/naming-convention */

  filepath: string | undefined = undefined;

  toString(this: Readonly<this>): string {
    return Profile.keys()
      .map((key) => `${key} ${this[key]}`)
      .join('\n');
  }

  async write(): Promise<string> {
    if (this.filepath === undefined) {
      const tmp = await fs.mkdtemp(path.join(util.tmpdir(), 'setup-texlive-'));
      this.filepath = path.join(tmp, 'texlive.profile');
      await fs.writeFile(this.filepath, this.toString());
      core.debug(`${this.filepath} created`);
    }
    return this.filepath;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  static keys() {
    // prettier-ignore
    return [
      'TEXDIR',
      'TEXMFLOCAL',
      'TEXMFSYSCONFIG',
      'TEXMFSYSVAR',
      'selected_scheme',
      // Old name                    // Current name
      'option_adjustrepo',           // instopt_adjustrepo
      'option_autobackup',           // tlpdbopt_autobackup
      'option_desktop_integration',  // tlpdbopt_desktop_integration
      'option_doc',                  // tlpdbopt_install_docfiles
      'option_file_assocs',          // tlpdbopt_file_assocs
      'option_menu_integration',
      'option_path',                 // instopt_adjustpath
      'option_src',                  // tlpdbopt_install_srcfiles
      'option_symlinks',             // instopt_adjustpath
      'option_w32_multi_user',       // tlpdbopt_w32_multi_user
    ] as const;
  }
}

/**
 * @returns The filename of the installer executable.
 */
function executable(version: tl.Version, platform: NodeJS.Platform): string {
  const ext = `${Number(version) > 2012 ? '-windows' : ''}.bat`;
  return `install-tl${platform === 'win32' ? ext : ''}`;
}

/**
 * Gets the URL of the main repository of TeX Live.
 *
 * @returns The `ctan` if the version is the latest, otherwise
 *   the URL of the historic archive on `https://ftp.math.utah.edu/pub/tex/`.
 *
 * @todo Use other archives as well.
 */
function repository(version: tl.Version): URL {
  const base =
    version === tl.LATEST_VERSION
      ? 'https://mirror.ctan.org/systems/texlive/'
      : `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`;
  const tlnet = `tlnet${
    Number(version) < 2010 || version === tl.LATEST_VERSION ? '' : '-final'
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

/**
 * Fixes bugs in the installer files and modify them for use in workflows.
 */
async function patch(version: tl.Version, texdir: string): Promise<void> {
  /**
   * Prevents `install-tl(-windows).bat` from being stopped by `pause`.
   */
  if (os.platform() === 'win32') {
    const target = path.join(texdir, executable(version, os.platform()));
    try {
      await util.updateFile(target, {
        search: /\bpause(?: Done)?\b/gmu,
        replace: '',
      });
    } catch (error) {
      if (!(types.isNativeError(error) && error.code === 'ENOENT')) {
        throw error;
      }
      core.info(`${target} not found`);
    }
  }
  /**
   * Fixes a syntax error in `tlpkg/TeXLive/TLWinGoo.pm`.
   */
  if (['2009', '2010'].includes(version)) {
    await util.updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLWinGoo.pm'),
      {
        search: /foreach \$p qw\((.*)\)/u,
        replace: 'foreach $$p (qw($1))',
      },
    );
  }
  /**
   * Defines Code Page 65001 as an alias for UTF-8 on Windows.
   * @see {@link https://github.com/dankogai/p5-encode/issues/37}
   */
  if (os.platform() === 'win32' && version === '2015') {
    await util.updateFile(
      path.join(texdir, 'tlpkg', 'tlperl', 'lib', 'Encode', 'Alias.pm'),
      {
        search: '# utf8 is blessed :)',
        replace: `$&\n    define_alias(qr/cp65001/i => '"utf-8-strict"');`,
      },
    );
  }
  /**
   * Makes it possible to use `\` as a directory separator on Windows.
   */
  if (os.platform() === 'win32' && Number(version) < 2019) {
    await util.updateFile(path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'), {
      search: String.raw`split (/\//, $tree)`,
      replace: String.raw`split (/[\/\\]/, $tree)`,
    });
  }
  /**
   * Adds support for macOS 11.x.
   */
  if (
    os.platform() === 'darwin' &&
    ['2017', '2018', '2019'].includes(version)
  ) {
    await util.updateFile(
      path.join(texdir, 'tlpkg', 'TeXLive', 'TLUtils.pm'),
      { search: 'if ($os_major != 10)', replace: 'if ($$os_major < 10)' },
      {
        search: 'if ($os_minor >= $mactex_darwin)',
        replace:
          'if ($$os_major >= 11) { $$CPU = "x86_64"; $$OS = "darwin"; }\n    els$&',
      },
    );
  }
}
