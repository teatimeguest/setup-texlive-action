import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
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

/**
 * A class for downloading and running the installer of TeX Live.
 */
export class InstallTL {
  private path: string;

  private constructor(
    private readonly tlversion: Version,
    directory: string,
    private readonly patch: Patch = new Patch(tlversion),
  ) {
    this.path = path.join(directory, InstallTL.executable(tlversion));
  }

  async run(profile: Profile): Promise<void> {
    for await (const dest of profile.open()) {
      const options = ['-profile', dest];
      if (!this.tlversion.isLatest()) {
        const repo = tlnet.historic(this.tlversion);
        // `install-tl` of versions prior to 2017 does not support HTTPS, and
        // that of version 2017 supports HTTPS but does not work properly.
        if (this.tlversion.number < 2018) {
          repo.protocol = 'http';
        }
        options.push(
          // Only version 2008 uses `-location` instead of `-repository`.
          this.tlversion.number === 2008 ? '-location' : '-repository',
          repo.href,
        );
      }
      tlpkg.check(await getExecOutput(this.path, options, { input: devNull }));
    }
    await this.patch.apply(profile.TEXDIR);
  }

  async version(): Promise<void> {
    await exec(this.path, ['-version'], { input: devNull });
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
    const dest = await extract(archive, platform() === 'win32' ? 'zip' : 'tgz');
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

export class Patch {
  private readonly hunks: ReadonlyArray<Patch.Hunk>;

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
    { description, file }: Patch.Hunk,
    input: Readonly<Buffer>,
    cwd: string,
  ): Promise<string> {
    try {
      const linePrefix = '\u001B[34m>\u001B[0m ';
      const { exitCode, stdout, stderr } = await getExecOutput('git', [
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

  private static readonly HUNKS: ReadonlyArray<Patch.Hunk> = [{
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

namespace Patch {
  export interface Hunk {
    readonly description: string;
    readonly platforms?: NodeJS.Platform;
    readonly versions?: { readonly since?: number; readonly until?: number };
    readonly file: string;
    readonly from: ReadonlyArray<string | Readonly<RegExp>>;
    readonly to: ReadonlyArray<string>;
  }
}
