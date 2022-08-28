import { mkdtemp, readFile, writeFile } from 'fs/promises';
import { platform } from 'os';
import * as path from 'path';
import { isNativeError } from 'util/types';

import { getExecOutput as spawn } from '@actions/exec';
import { rmRF } from '@actions/io';
import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';
import { Exclude, Expose, Type } from 'class-transformer';
import type { MarkOptional, PickProperties } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { type Texmf, Version, tlnet, tlpkg } from '#/texlive';
import { Serializable, extract, tmpdir } from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: Version,
    private readonly installtl: string,
  ) {}

  async run(profile: Profile): Promise<void> {
    for await (const dest of profile.open()) {
      const options = ['-profile', dest];
      if (!Version.isLatest(this.version)) {
        const repo = tlnet.historic(this.version);
        // `install-tl` of versions prior to 2017 does not support HTTPS, and
        // that of version 2017 supports HTTPS but does not work properly.
        if (this.version < '2018') {
          repo.protocol = 'http';
        }
        options.push(
          // Only version 2008 uses `-location` instead of `-repository`.
          this.version === '2008' ? '-location' : '-repository',
          repo.href,
        );
      }
      const { stderr } = await spawn(this.installtl, options);
      tlpkg.check(stderr);
    }
    await patch(this.version, profile.TEXDIR);
  }

  static restore(version: Version): InstallTL | undefined {
    let dest = '';
    try {
      dest = findTool(this.executable(version), version);
    } catch (cause) {
      log.info('Failed to restore installer', { cause });
    }
    if (dest === '') {
      return undefined;
    } else {
      log.info('Found in tool cache');
      return new this(version, path.join(dest, this.executable(version)));
    }
  }

  static async download(version: Version): Promise<InstallTL> {
    const url = this.url(version).href;
    log.info(`Downloading ${url}`);
    const archive = await downloadTool(url);

    log.info(`Extracting installer from ${archive}`);
    const dest = await extract(
      archive,
      platform() === 'win32' ? 'zip' : 'tgz',
    );
    await patch(version, dest);

    try {
      log.info('Adding to tool cache');
      await cacheDir(dest, this.executable(version), version);
    } catch (cause) {
      log.info('Failed to cache installer', { cause });
    }

    return new this(version, path.join(dest, this.executable(version)));
  }

  static async acquire(version: Version): Promise<InstallTL> {
    return this.restore(version) ?? await this.download(version);
  }

  static executable(version: Version): string {
    if (platform() !== 'win32') {
      return 'install-tl';
    } else if (version < '2013') {
      return 'install-tl.bat';
    } else {
      return 'install-tl-windows.bat';
    }
  }

  private static url(version: Version): URL {
    const archive = platform() === 'win32'
      ? 'install-tl.zip'
      : 'install-tl-unx.tar.gz';
    return new URL(
      Version.isLatest(version) ? path.posix.join('..', archive) : archive,
      tlnet.historic(version),
    );
  }
}

@Exclude()
export class Profile extends Serializable implements Texmf.SystemTrees {
  constructor(
    readonly version: Version,
    { TEXDIR, TEXMFLOCAL, TEXMFSYSCONFIG, TEXMFSYSVAR }: MarkOptional<
      Texmf.SystemTrees,
      'TEXMFSYSCONFIG' | 'TEXMFSYSVAR'
    >,
  ) {
    super();
    // `scheme-infraonly` was first introduced in TeX Live 2016.
    this.selected_scheme = `scheme-${
      version < '2016' ? 'minimal' : 'infraonly'
    }`;
    this.TEXDIR = TEXDIR;
    this.TEXMFLOCAL = TEXMFLOCAL;
    this.TEXMFSYSCONFIG = TEXMFSYSCONFIG ?? path.join(TEXDIR, 'texmf-config');
    this.TEXMFSYSVAR = TEXMFSYSVAR ?? path.join(TEXDIR, 'texmf-var');
    this.instopt_adjustrepo = Version.isLatest(this.version);
  }

  async *open(this: Readonly<this>): AsyncGenerator<string, void> {
    const tmp = await mkdtemp(path.join(tmpdir(), 'setup-texlive-'));
    const target = path.join(tmp, 'texlive.profile');
    await writeFile(target, this.toString());
    try {
      yield target;
    } finally {
      await rmRF(tmp);
    }
  }

  override toString(): string {
    const plain = this.toPlain({
      version: Number(this.version),
      groups: [platform()],
    });
    return Object.entries(plain).map((entry) => entry.join(' ')).join('\n');
  }

  @Expose()
  readonly selected_scheme: string;

  @Expose()
  readonly TEXDIR: string;
  @Expose()
  readonly TEXMFLOCAL: string;
  @Expose()
  readonly TEXMFSYSCONFIG: string;
  @Expose()
  readonly TEXMFSYSVAR: string;

  @Expose({ since: 2017 })
  readonly instopt_adjustpath: boolean = false;
  @Expose({ since: 2017 })
  readonly instopt_adjustrepo: boolean;
  @Expose({ since: 2017 })
  readonly tlpdbopt_autobackup: boolean = false;
  @Expose({ since: 2017 })
  readonly tlpdbopt_install_docfiles: boolean = false;
  @Expose({ since: 2017 })
  readonly tlpdbopt_install_srcfiles: boolean = false;

  // Options for Windows
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_desktop_integration: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_file_assocs: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_w32_multi_user: boolean = false;

  // Removed option
  @Expose({ since: 2012, until: 2017, groups: ['win32'] })
  readonly option_menu_integration: boolean = false;

  // Old option names
  @Expose({ until: 2009 })
  get option_symlinks(): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2009, until: 2017 })
  get option_path(): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2011, until: 2017 })
  get option_adjustrepo(): boolean {
    return this.instopt_adjustrepo;
  }
  @Expose({ until: 2017 })
  get option_autobackup(): boolean {
    return this.tlpdbopt_autobackup;
  }
  @Expose({ until: 2017 })
  get option_doc(): boolean {
    return this.tlpdbopt_install_docfiles;
  }
  @Expose({ until: 2017 })
  get option_src(): boolean {
    return this.tlpdbopt_install_srcfiles;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  get option_desktop_integration(): boolean {
    return this.tlpdbopt_desktop_integration;
  }
  @Expose({ until: 2017, groups: ['win32'] })
  get option_file_assocs(): boolean {
    return this.tlpdbopt_file_assocs;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  get option_w32_multi_user(): boolean {
    return this.tlpdbopt_w32_multi_user;
  }

  static {
    for (const key of keys<PickProperties<Profile, boolean>>()) {
      Type(() => Number)(this.prototype, key);
    }
  }
}

async function patch(version: Version, base: string): Promise<void> {
  interface Patch {
    readonly platforms?: NodeJS.Platform;
    readonly versions?: { readonly since?: Version; readonly until?: Version };
    readonly file: string;
    readonly from: ReadonlyArray<string | Readonly<RegExp>>;
    readonly to: ReadonlyArray<string>;
  }
  const patches: ReadonlyArray<Patch> = [{
    // Prevents `install-tl(-windows).bat` from being stopped by `pause`.
    platforms: 'win32',
    file: InstallTL.executable(version),
    from: [/\bpause(?: Done)?\b/gmu],
    to: [''],
  }, {
    // Fixes a syntax error.
    versions: { since: '2009', until: '2011' },
    file: 'tlpkg/TeXLive/TLWinGoo.pm',
    from: ['/foreach $p qw((.*))/u'],
    to: ['foreach $$p (qw($1))'],
  }, {
    // Defines Code Page 65001 as an alias for UTF-8 on Windows.
    // (see: https://github.com/dankogai/p5-encode/issues/37)
    platforms: 'win32',
    versions: { since: '2015', until: '2016' },
    file: 'tlpkg/tlperl/lib/Encode/Alias.pm',
    from: ['# utf8 is blessed :)'],
    to: [`define_alias(qr/cp65001/i => '"utf-8-strict"');`],
  }, {
    // Makes it possible to use `\` as a directory separator on Windows.
    platforms: 'win32',
    versions: { until: '2020' },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['split (/\\//, $tree)'],
    to: ['split (/[\\/\\\\]/, $$tree)'],
  }, {
    // Adds support for macOS 11 or later.
    platforms: 'darwin',
    versions: { since: '2017', until: '2020' },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['$os_major != 10', '$os_minor >= $mactex_darwin'],
    to: ['$$os_major < 10', '$$os_major >= 11 || $&'],
  }] as const;
  const apply = async (
    { platforms = platform(), versions = {}, file, from, to }: Patch,
  ): Promise<void> => {
    const { since = version, until = '9999' as Version } = versions;
    if (platforms === platform() && since <= version && version < until) {
      const target = path.join(base, file);
      try {
        await writeFile(
          target,
          from.reduce<string>(
            (contents, search, i) => contents.replace(search, to[i] ?? ''),
            await readFile(target, 'utf8'),
          ),
        );
      } catch (error) {
        if (isNativeError(error) && error.code === 'ENOENT') {
          log.debug(`${target} not found`);
          return;
        }
        throw error;
      }
    }
  };
  log.info('Applying patches');
  await Promise.all(patches.map(apply));
}

/* eslint @typescript-eslint/naming-convention: off */
