import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { types } from 'util';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';
import { keys } from 'ts-transformer-keys';

import * as tl from './texlive';
import Version = tl.Version;
import * as util from './utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: Version,
    private readonly bin: string,
  ) {}

  async run(profile: Readonly<Profile>): Promise<void> {
    const target = path.join(util.tmpdir(), 'texlive.profile');
    await fs.writeFile(target, Profile.format(profile));
    const options = ['-no-gui', '-profile', target];

    if (this.version !== Version.LATEST) {
      const repo = tl.historic(this.version);
      /**
       * `install-tl` of versions prior to 2017 does not support HTTPS, and
       * that of version 2017 supports HTTPS but does not work properly.
       */
      if (Number(this.version) < 2018) {
        repo.protocol = 'http';
      }
      options.push(
        /**
         * Only version 2008 uses `-location` instead of `-repository`.
         */
        this.version === '2008' ? '-location' : '-repository',
        repo.href,
      );
    }

    await exec.exec(this.bin, options);
    core.info('Applying patches');
    await patch(this.version, profile.TEXDIR);
  }

  static async acquire(version: Version): Promise<InstallTL> {
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

    const isWin = os.platform() === 'win32';
    const target = isWin ? 'install-tl.zip' : 'install-tl-unx.tar.gz';
    let dest = await util.restoreToolCache(target, version);

    if (dest === undefined) {
      const url = new URL(
        version === Version.LATEST ? `../${target}` : target,
        tl.historic(version),
      );
      core.info(`Downloading ${url.href}`);
      const archive = await tool.downloadTool(url.href);

      core.info('Extracting');
      dest = await util.extract(archive, isWin ? 'zip' : 'tgz');

      core.info('Applying patches');
      await patch(version, dest);
      await util.saveToolCache(dest, target, version);
    }

    return new InstallTL(
      version,
      path.join(dest, executable(version, os.platform())),
    );
  }
}

export interface Env {
  ['TEXLIVE_DOWNLOADER']?: string;
  ['TL_DOWNLOAD_PROGRAM']?: string;
  ['TL_DOWNLOAD_ARGS']?: string;
  ['TEXLIVE_INSTALL_ENV_NOCHECK']?: string;
  ['TEXLIVE_INSTALL_NO_CONTEXT_CACHE']?: string;
  ['TEXLIVE_INSTALL_NO_RESUME']?: string;
  ['TEXLIVE_INSTALL_NO_WELCOME']?: string;
  ['TEXLIVE_INSTALL_PAPER']?: string;
  ['TEXLIVE_INSTALL_PREFIX']?: string;
  ['TEXLIVE_INSTALL_TEXDIR']?: string;
  ['TEXLIVE_INSTALL_TEXMFCONFIG']?: string;
  ['TEXLIVE_INSTALL_TEXMFVAR']?: string;
  ['TEXLIVE_INSTALL_TEXMFHOME']?: string;
  ['TEXLIVE_INSTALL_TEXMFLOCAL']?: string;
  ['TEXLIVE_INSTALL_TEXMFSYSCONFIG']?: string;
  ['TEXLIVE_INSTALL_TEXMFSYSVAR']?: string;
  ['NOPERLDOC']?: string;
}

export class Profile {
  constructor(version: Version, prefix: string) {
    this.TEXDIR = path.join(prefix, version);
    this.TEXMFLOCAL = path.join(prefix, 'texmf-local');
    this.TEXMFSYSCONFIG = path.join(this.TEXDIR, 'texmf-config');
    this.TEXMFSYSVAR = path.join(this.TEXDIR, 'texmf-var');
    /**
     * `scheme-infraonly` was first introduced in TeX Live 2016.
     */
    this.selected_scheme = `scheme-${
      Number(version) < 2016 ? 'minimal' : 'infraonly'
    }`;
    this.option_adjustrepo = version === Version.LATEST ? '1' : '0';
  }
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
  readonly ['TEXDIR']: string;
  readonly ['TEXMFLOCAL']: string;
  readonly ['TEXMFSYSCONFIG']: string;
  readonly ['TEXMFSYSVAR']: string;
  readonly ['selected_scheme']: string;
  readonly ['option_adjustrepo']: string;
  readonly ['option_autobackup']: string = '0';
  readonly ['option_desktop_integration']: string = '0';
  readonly ['option_doc']: string = '0';
  readonly ['option_file_assocs']: string = '0';
  readonly ['option_menu_integration']: string = '0';
  readonly ['option_path']: string = '0';
  readonly ['option_src']: string = '0';
  readonly ['option_symlinks']: string = '0';
  readonly ['option_w32_multi_user']: string = '0';
}

export namespace Profile {
  export function format(profile: Profile): string {
    return keys<Profile>()
      .map((key) => `${key} ${profile[key]}`)
      .join('\n');
  }
}

/**
 * @returns The filename of the installer executable.
 */
function executable(version: Version, platform: NodeJS.Platform): string {
  const ext = `${Number(version) > 2012 ? '-windows' : ''}.bat`;
  return `install-tl${platform === 'win32' ? ext : ''}`;
}

/**
 * Fixes bugs in the installer files and modify them for use in workflows.
 */
async function patch(version: Version, texdir: string): Promise<void> {
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
