import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { isNativeError } from 'util/types';

import { getExecOutput as popen } from '@actions/exec';
import { rmRF as rm } from '@actions/io';
import * as tool from '@actions/tool-cache';
import { Exclude, Expose, Type } from 'class-transformer';
import type { PickProperties } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { Tlmgr, Version, historic } from '#/texlive';
import { Serializable, extract, tmpdir } from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: Version,
    private readonly installtl: string,
  ) {}

  async run(profile: Readonly<Profile>): Promise<void> {
    for await (const dest of profile.open()) {
      const options = ['-no-gui', '-profile', dest];
      if (!Version.isLatest(this.version)) {
        const repo = historic(this.version);
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
      Tlmgr.check((await popen(this.installtl, options)).stderr);
    }
    await patch(this.version, profile.TEXDIR);
  }

  static restore(version: Version): InstallTL | undefined {
    let dest = '';
    try {
      dest = tool.find(InstallTL.archive(), version);
    } catch (error) {
      log.info('Failed to restore installer', { cause: error });
    }
    if (dest === '') {
      return undefined;
    } else {
      log.info('Found in tool cache');
      return new InstallTL(
        version,
        path.join(dest, InstallTL.executable(version)),
      );
    }
  }

  static async download(version: Version): Promise<InstallTL> {
    const url = InstallTL.url(version).href;
    log.info(`Downloading ${url}`);
    const archive = await tool.downloadTool(url);

    log.info(`Extracting installer from ${archive}`);
    const dest = await extract(
      archive,
      os.platform() === 'win32' ? 'zip' : 'tgz',
    );
    await patch(version, dest);

    try {
      log.info('Adding to tool cache');
      await tool.cacheDir(dest, InstallTL.archive(), version);
    } catch (error) {
      log.info('Failed to cache installer', { cause: error });
    }

    return new InstallTL(
      version,
      path.join(dest, InstallTL.executable(version)),
    );
  }

  static executable(
    version: Version,
    platform: NodeJS.Platform = os.platform(),
  ): string {
    if (platform !== 'win32') {
      return 'install-tl';
    } else if (version < '2013') {
      return 'install-tl.bat';
    } else {
      return 'install-tl-windows.bat';
    }
  }

  private static archive(): string {
    return os.platform() === 'win32'
      ? 'install-tl.zip'
      : 'install-tl-unx.tar.gz';
  }

  private static url(version: Version): URL {
    let target = InstallTL.archive();
    if (Version.isLatest(version)) {
      target = path.posix.join('..', target);
    }
    return new URL(target, historic(version));
  }
}

@Exclude()
export class Profile extends Serializable {
  constructor(readonly version: Version, prefix: string) {
    super();
    this.TEXDIR = path.join(prefix, version);
    this.TEXMFLOCAL = path.join(prefix, 'texmf-local');
    this.TEXMFSYSCONFIG = path.join(this.TEXDIR, 'texmf-config');
    this.TEXMFSYSVAR = path.join(this.TEXDIR, 'texmf-var');
    // `scheme-infraonly` was first introduced in TeX Live 2016.
    this.selected_scheme = `scheme-${
      version < '2016' ? 'minimal' : 'infraonly'
    }`;
    this.instopt_adjustrepo = Version.isLatest(version);
  }

  async *open(this: Readonly<this>): AsyncGenerator<string, void> {
    const tmp = await fs.mkdtemp(path.join(tmpdir(), 'setup-texlive-'));
    const target = path.join(tmp, 'texlive.profile');
    await fs.writeFile(target, this.toString());
    try {
      yield target;
    } finally {
      await rm(tmp);
    }
  }

  override toString(): string {
    const plain = this.toPlain({
      version: Number(this.version),
      groups: [os.platform()],
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

  // Deleted option
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
  const fixes = [{
    // Prevents `install-tl(-windows).bat` from being stopped by `pause`.
    platform: 'win32',
    file: InstallTL.executable(version, 'win32'),
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
    platform: 'win32',
    versions: { since: '2015', until: '2016' },
    file: 'tlpkg/tlperl/lib/Encode/Alias.pm',
    from: ['# utf8 is blessed :)'],
    to: [`define_alias(qr/cp65001/i => '"utf-8-strict"');`],
  }, {
    // Makes it possible to use `\` as a directory separator on Windows.
    platform: 'win32',
    versions: { until: '2020' },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['split (/\\//, $tree)'],
    to: ['split (/[\\/\\\\]/, $$tree)'],
  }, {
    // Add support for macOs 11 or later.
    platform: 'darwin',
    versions: { since: '2017', until: '2020' },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['$os_major != 10', '$os_minor >= $mactex_darwin'],
    to: ['$$os_major < 10', '$$os_major >= 11 || $&'],
  }];
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  const apply = async (fix: typeof fixes[number]): Promise<void> => {
    if (
      (fix.platform === undefined || fix.platform === os.platform())
      && (fix.versions?.since ?? version) <= version
      && (fix.versions?.until ?? '9999') > version
    ) {
      const target = path.join(base, fix.file);
      let contents: string;
      try {
        contents = await fs.readFile(target, 'utf8');
      } catch (error) {
        if (isNativeError(error) && error.code === 'ENOENT') {
          log.debug(`${target} not found`);
          return;
        }
        throw error;
      }
      fix.from.forEach((search, i) => {
        contents = contents.replace(search, fix.to[i] ?? '');
      });
      await fs.writeFile(target, contents);
    }
  };
  log.info('Applying patches');
  await Promise.all(fixes.map(apply));
}

declare module 'util/types' {
  /**
   * A type-guard for the error type of Node.js.
   * Since `NodeJS.ErrnoException` is defined as an interface,
   * we cannot write `error instanceof NodeJS.ErrnoException`, but
   * `util.types.isNativeError` is sufficient
   * because all properties of `NodeJS.ErrnoException` are optional.
   */
  // eslint-disable-next-line @typescript-eslint/no-shadow
  function isNativeError(error: unknown): error is NodeJS.ErrnoException;
}

/* eslint @typescript-eslint/naming-convention: off */
