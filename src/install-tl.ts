import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { types } from 'util';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tool from '@actions/tool-cache';
import { Exclude, Expose, instanceToPlain, Type } from 'class-transformer';
import 'reflect-metadata';

import * as tl from '#/texlive';
import Version = tl.Version;
import * as util from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: Version,
    private readonly bin: string,
  ) {}

  async run(profile: Readonly<Profile>): Promise<void> {
    for await (const target of profile.open()) {
      const options = ['-no-gui', '-profile', target];
      if (this.version !== Version.LATEST) {
        const repo = tl.historic(this.version);
        /**
         * `install-tl` of versions prior to 2017 does not support HTTPS, and
         * that of version 2017 supports HTTPS but does not work properly.
         */
        if (this.version < '2018') {
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
    }
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
    if (version < (os.platform() === 'darwin' ? '2013' : '2008')) {
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
  ['TEXLIVE_INSTALL_NO_DISKCHECK']?: string;
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

@Exclude()
export class Profile {
  constructor(readonly version: Version, prefix: string) {
    this.TEXDIR = path.join(prefix, version);
    this.TEXMFLOCAL = path.join(prefix, 'texmf-local');
    this.TEXMFSYSCONFIG = path.join(this.TEXDIR, 'texmf-config');
    this.TEXMFSYSVAR = path.join(this.TEXDIR, 'texmf-var');
    /**
     * `scheme-infraonly` was first introduced in TeX Live 2016.
     */
    this.selected_scheme = `scheme-${
      version < '2016' ? 'minimal' : 'infraonly'
    }`;
    this.instopt_adjustrepo = version === Version.LATEST;
  }

  async *open(this: Readonly<this>): AsyncGenerator<string, void> {
    const tmpdir = await fs.mkdtemp(path.join(util.tmpdir(), 'setup-texlive-'));
    const target = path.join(tmpdir, 'texlive.profile');
    await fs.writeFile(target, this.toString());
    try {
      yield target;
    } finally {
      await io.rmRF(tmpdir);
    }
  }

  toString(this: Readonly<this>): string {
    const plain = instanceToPlain(this, {
      version: Number(this.version),
      groups: [os.platform()],
    });
    return Object.entries(plain)
      .map(([key, value]) => `${key} ${value}`)
      .join('\n');
  }

  @Expose() readonly ['selected_scheme']: string;

  @Expose() readonly ['TEXDIR']: string;
  @Expose() readonly ['TEXMFLOCAL']: string;
  @Expose() readonly ['TEXMFSYSCONFIG']: string;
  @Expose() readonly ['TEXMFSYSVAR']: string;

  @Expose({ since: 2017 })
  @Type(() => Number)
  readonly ['instopt_adjustpath']: boolean = false;
  @Expose({ since: 2017 })
  @Type(() => Number)
  readonly ['instopt_adjustrepo']: boolean;
  @Expose({ since: 2017 })
  @Type(() => Number)
  readonly ['tlpdbopt_autobackup']: boolean = false;
  @Expose({ since: 2017 })
  @Type(() => Number)
  readonly ['tlpdbopt_install_docfiles']: boolean = false;
  @Expose({ since: 2017 })
  @Type(() => Number)
  readonly ['tlpdbopt_install_srcfiles']: boolean = false;

  // Options for Windows
  @Expose({ since: 2017, groups: ['win32'] })
  @Type(() => Number)
  readonly ['tlpdbopt_desktop_integration']: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  @Type(() => Number)
  readonly ['tlpdbopt_file_assocs']: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  @Type(() => Number)
  readonly ['tlpdbopt_w32_multi_user']: boolean = false;

  // Deleted option
  @Expose({ since: 2012, until: 2017, groups: ['win32'] })
  @Type(() => Number)
  readonly ['option_menu_integration']: boolean = false;

  // Old option names
  @Expose({ until: 2009 })
  @Type(() => Number)
  get ['option_symlinks'](): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2009, until: 2017 })
  @Type(() => Number)
  get ['option_path'](): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2011, until: 2017 })
  @Type(() => Number)
  get ['option_adjustrepo'](): boolean {
    return this.instopt_adjustrepo;
  }
  @Expose({ until: 2017 })
  @Type(() => Number)
  get ['option_autobackup'](): boolean {
    return this.tlpdbopt_autobackup;
  }
  @Expose({ until: 2017 })
  @Type(() => Number)
  get ['option_doc'](): boolean {
    return this.tlpdbopt_install_docfiles;
  }
  @Expose({ until: 2017 })
  @Type(() => Number)
  get ['option_src'](): boolean {
    return this.tlpdbopt_install_srcfiles;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  @Type(() => Number)
  get ['option_desktop_integration'](): boolean {
    return this.tlpdbopt_desktop_integration;
  }
  @Expose({ until: 2017, groups: ['win32'] })
  @Type(() => Number)
  get ['option_file_assocs'](): boolean {
    return this.tlpdbopt_file_assocs;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  @Type(() => Number)
  get ['option_w32_multi_user'](): boolean {
    return this.tlpdbopt_w32_multi_user;
  }
}

/**
 * @returns The filename of the installer executable.
 */
function executable(version: Version, platform: NodeJS.Platform): string {
  const ext = `${version > '2012' ? '-windows' : ''}.bat`;
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
  if (os.platform() === 'win32' && version < '2019') {
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
