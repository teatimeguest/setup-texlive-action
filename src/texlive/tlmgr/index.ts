import path from 'node:path';

import { exec, getExecOutput } from '@actions/exec';
import { cache as Cache } from 'decorator-cache-getter';

import * as ctan from '#/ctan';
import * as log from '#/log';
import * as tlpkg from '#/texlive/tlpkg';
import type { Version } from '#/texlive/version';

import { Conf } from '#/texlive/tlmgr/conf';
import { Path } from '#/texlive/tlmgr/path';
import { Pinning } from '#/texlive/tlmgr/pinning';
import { Repository } from '#/texlive/tlmgr/repository';

export class Tlmgr {
  constructor(
    private readonly options: {
      readonly version: Version;
      readonly TEXDIR: string;
    },
  ) {}

  @Cache
  get conf(): Conf {
    return new Conf(this.options);
  }

  async install(this: void, packages: Iterable<string>): Promise<void> {
    const args = ['install', ...packages];
    if (args.length > 1) {
      const { exitCode, stderr } = await getExecOutput('tlmgr', args, {
        ignoreReturnCode: true,
      });
      tlpkg.check(stderr);
      if (exitCode !== 0) {
        const names = Array.from(
          stderr.matchAll(/^tlmgr install: package (\S+) not present/gmu),
          ([, name = '']) => name,
        );
        if (names.length === 0) {
          throw new Error(`\`tlmgr\` exited with ${exitCode}`);
        }
        // Some packages have different names in TeX Live and CTAN, and
        // the DEPENDS.txt format requires a CTAN name, while
        // `tlmgr install` requires a TeX Live one.
        // To install such packages with tlmgr,
        // the action uses the CTAN API to look up thier names in TeX Live.
        log.info(`Trying to resolve package names: (${names.join(', ')})`);
        const tlnames = await Promise.all(names.map(async (name) => {
          let pkg;
          try {
            pkg = await ctan.pkg(name);
          } catch (cause) {
            throw new Error(`Package ${name} not found`, { cause });
          }
          if (pkg.texlive === undefined) {
            log.debug(`Unexpected response data: ${JSON.stringify(pkg)}`);
            throw new Error(`Failed to install ${name}`);
          }
          log.info(`  ${name} (in CTAN) => ${pkg.texlive} (in TeX Live)`);
          return pkg.texlive;
        }));
        tlpkg.check(await getExecOutput('tlmgr', ['install', ...tlnames]));
      }
    }
  }

  /**
   * Lists packages by reading `texlive.tlpdb` directly
   * instead of running `tlmgr list`.
   */
  async *list(): AsyncGenerator<tlpkg.Tlpobj, void, void> {
    const tlpdbPath = path.join(this.options.TEXDIR, 'tlpkg', 'texlive.tlpdb');
    yield* tlpkg.tlpdb(tlpdbPath);
  }

  @Cache
  get path(): Path {
    return new Path(this.options);
  }

  @Cache
  get pinning(): Pinning {
    return new Pinning(this.options);
  }

  @Cache
  get repository(): Repository {
    return new Repository(this.options);
  }

  async update(
    packages: Iterable<string> = [],
    options: Readonly<UpdateOptions> = {},
  ): Promise<void> {
    const args = (options.all ?? false) ? ['--all'] : [...packages];
    if (options.self ?? false) {
      // tlmgr for TeX Live 2008 does not have `self` option
      args.push(
        this.options.version.number > 2008 ? '--self' : 'texlive.infra',
      );
    }
    if (
      (options.reinstallForciblyRemoved ?? false)
      // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
      && this.options.version.number >= 2009
    ) {
      args.unshift('--reinstall-forcibly-removed');
    }
    await exec('tlmgr', ['update', ...args]);
  }

  async version(this: void): Promise<void> {
    await exec('tlmgr', ['--version']);
  }
}

export interface UpdateOptions {
  readonly all?: boolean;
  readonly self?: boolean;
  readonly reinstallForciblyRemoved?: boolean;
}
