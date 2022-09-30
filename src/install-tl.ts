import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import path from 'node:path';

import { getExecOutput as spawn } from '@actions/exec';
import { cacheDir, downloadTool, find as findTool } from '@actions/tool-cache';
import { Expose, Type } from 'class-transformer';
import type { MarkOptional, PickProperties } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { type Texmf, Version, tlnet, tlpkg } from '#/texlive';
import { Serializable, extract, mkdtemp } from '#/utility';

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private constructor(
    private readonly version: Version,
    private readonly directory: string,
    private readonly patch: Patch = new Patch(version),
  ) {}

  async run(profile: Profile): Promise<void> {
    const installtl = path.join(
      this.directory,
      InstallTL.executable(this.version),
    );
    for await (const dest of profile.open()) {
      const options = ['-profile', dest];
      if (!this.version.isLatest()) {
        const repo = tlnet.historic(this.version);
        // `install-tl` of versions prior to 2017 does not support HTTPS, and
        // that of version 2017 supports HTTPS but does not work properly.
        if (this.version.number < 2018) {
          repo.protocol = 'http';
        }
        options.push(
          // Only version 2008 uses `-location` instead of `-repository`.
          this.version.number === 2008 ? '-location' : '-repository',
          repo.href,
        );
      }
      // Prevents `install-tl(-windows).bat` from being stopped by `pause`.
      const execOptions = { input: Buffer.alloc(0) };
      tlpkg.check(await spawn(installtl, options, execOptions));
    }
    await this.patch.apply(profile.TEXDIR);
  }

  static restore(version: Version): InstallTL | undefined {
    let dest = '';
    try {
      dest = findTool(this.executable(version), version.toString());
    } catch (cause) {
      log.info('Failed to restore installer', { cause });
    }
    if (dest === '') {
      return undefined;
    } else {
      log.info('Found in tool cache');
      return new this(version, dest);
    }
  }

  static async download(version: Version): Promise<InstallTL> {
    const { href: url } = this.url(version);
    log.info(`Downloading ${url}`);
    const archive = await downloadTool(url);

    log.info(`Extracting installer from ${archive}`);
    const dest = await extract(
      archive,
      platform() === 'win32' ? 'zip' : 'tgz',
    );
    const patch = new Patch(version);
    await patch.apply(dest);

    try {
      log.info('Adding to tool cache');
      await cacheDir(dest, this.executable(version), version.toString());
    } catch (cause) {
      log.info('Failed to cache installer', { cause });
    }

    return new this(version, dest, patch);
  }

  static async acquire(version: Version): Promise<InstallTL> {
    return this.restore(version) ?? await this.download(version);
  }

  static executable(this: void, { number: version }: Version): string {
    if (platform() !== 'win32') {
      return 'install-tl';
    } else if (version < 2013) {
      return 'install-tl.bat';
    } else {
      return 'install-tl-windows.bat';
    }
  }

  private static url(this: void, version: Version): URL {
    return new URL(
      platform() === 'win32' ? 'install-tl.zip' : 'install-tl-unx.tar.gz',
      version.isLatest() ? tlnet.CTAN : tlnet.historic(version),
    );
  }
}

export class Profile extends Serializable implements Texmf.SystemTrees {
  constructor(
    readonly version: Version,
    texmf: MarkOptional<Texmf.SystemTrees, 'TEXMFSYSCONFIG' | 'TEXMFSYSVAR'>,
  ) {
    super();
    // `scheme-infraonly` was first introduced in TeX Live 2016.
    this.selected_scheme = `scheme-${
      version.number < 2016 ? 'minimal' : 'infraonly'
    }`;
    const { TEXDIR, TEXMFLOCAL, TEXMFSYSCONFIG, TEXMFSYSVAR } = texmf;
    this.TEXDIR = TEXDIR;
    this.TEXMFLOCAL = TEXMFLOCAL;
    this.TEXMFSYSCONFIG = TEXMFSYSCONFIG ?? path.join(TEXDIR, 'texmf-config');
    this.TEXMFSYSVAR = TEXMFSYSVAR ?? path.join(TEXDIR, 'texmf-var');
    this.instopt_adjustrepo = this.version.isLatest();
  }

  async *open(): AsyncGenerator<string, void, void> {
    for await (const tmp of mkdtemp()) {
      const target = path.join(tmp, 'texlive.profile');
      await writeFile(target, this.toString());
      yield target;
    }
  }

  override toString(): string {
    const plain = this.toPlain({
      version: this.version.number,
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

export class Patch {
  private readonly hunks: typeof Patch.HUNKS;

  constructor({ number: version }: Version) {
    this.hunks = Patch.HUNKS.filter((
      {
        platforms = platform(),
        versions: { since = -Infinity, until = Infinity } = {},
      },
    ) => platforms === platform() && since <= version && version < until);
  }

  async apply(texdir: string): Promise<void> {
    if (this.hunks.length > 0) {
      log.info('Applying patches');
      const changes = await Promise.all(this.hunks.map(async (hunk) => {
        const target = path.join(texdir, hunk.file);
        const content = Buffer.from(hunk.from.reduce<string>(
          (s, from, i) => s.replace(from, hunk.to[i] ?? ''),
          await readFile(target, 'utf8'),
        ));
        const diff = await this.diff(hunk, content, texdir);
        await writeFile(target, content);
        return diff;
      }));
      log.info(changes.filter(Boolean).join('\n'));
    }
  }

  private async diff(
    { description, file }: typeof this.hunks[number],
    input: Readonly<Buffer>,
    cwd: string,
  ): Promise<string> {
    try {
      const linePrefix = '\u001B[34m>\u001B[0m ';
      const { exitCode, stdout, stderr } = await spawn('git', [
        'diff',
        '--no-index',
        '--color',
        `--line-prefix=${linePrefix}`,
        '--',
        file,
        '-',
      ], { input, cwd, silent: true, ignoreReturnCode: true });
      // dprint-ignore
      switch (exitCode) {
        case 0: break;
        case 1: return linePrefix + description + '\n' + stdout.trimEnd();
        default: log.debug(`git-diff exited with ${exitCode}: ${stderr}`);
      }
    } catch (cause) {
      log.debug('Failed to exec git-diff', { cause });
    }
    return '';
  }

  private static readonly HUNKS: ReadonlyArray<{
    readonly description: string;
    readonly platforms?: NodeJS.Platform;
    readonly versions?: { readonly since?: number; readonly until?: number };
    readonly file: string;
    readonly from: ReadonlyArray<string | Readonly<RegExp>>;
    readonly to: ReadonlyArray<string>;
  }> = [{
    description: 'Fixes a syntax error.',
    versions: { since: 2009, until: 2011 },
    file: 'tlpkg/TeXLive/TLWinGoo.pm',
    from: [/foreach \$p qw\((.*)\)/u],
    to: ['foreach $$p (qw($1))'],
  }, {
    // See: https://github.com/dankogai/p5-encode/issues/37
    description: 'Defines Code Page 65001 as an alias for UTF-8 on Windows.',
    platforms: 'win32',
    versions: { since: 2015, until: 2016 },
    file: 'tlpkg/tlperl/lib/Encode/Alias.pm',
    from: ['# utf8 is blessed :)\n'],
    to: [`$&    define_alias(qr/cp65001/i => '"utf-8-strict"');\n`],
  }, {
    description:
      'Makes it possible to use `\\` as a directory separator on Windows.',
    platforms: 'win32',
    versions: { until: 2019 },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['split (/\\//, $tree)'],
    to: ['split (/[\\/\\\\]/, $$tree)'],
  }, {
    description: 'Adds support for macOS 11 or later.',
    platforms: 'darwin',
    versions: { since: 2017, until: 2020 },
    file: 'tlpkg/TeXLive/TLUtils.pm',
    from: ['$os_major != 10', '$os_minor >= $mactex_darwin'],
    to: ['$$os_major < 10', '$$os_major > 10 || $&'],
  }];
}
