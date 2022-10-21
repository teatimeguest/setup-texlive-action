import path from 'node:path';

import { addPath, exportVariable } from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
import { cache as Cache } from 'decorator-cache-getter';

import * as ctan from '#/ctan';
import * as log from '#/log';
import { type Texmf, type Version } from '#/texlive';
import * as tlpkg from '#/tlpkg';
import { determine } from '#/utility';

export class Tlmgr {
  constructor(
    private readonly tlversion: Version,
    private readonly TEXDIR: string,
  ) {}

  @Cache
  get conf(): Tlmgr.Conf {
    return new Tlmgr.Conf(this.tlversion, this.TEXDIR);
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
    const tlpdbPath = path.join(this.TEXDIR, 'tlpkg', 'texlive.tlpdb');
    yield* tlpkg.tlpdb(tlpdbPath);
  }

  @Cache
  get path(): Tlmgr.Path {
    return new Tlmgr.Path(this.TEXDIR);
  }

  @Cache
  get pinning(): Tlmgr.Pinning {
    return new Tlmgr.Pinning(this.tlversion);
  }

  @Cache
  get repository(): Tlmgr.Repository {
    return new Tlmgr.Repository(this.tlversion);
  }

  async update(
    packages: Iterable<string> = [],
    options: Readonly<Tlmgr.UpdateOptions> = {},
  ): Promise<void> {
    const args = (options.all ?? false) ? ['--all'] : [...packages];
    if (options.self ?? false) {
      // tlmgr for TeX Live 2008 does not have `self` option
      args.push(this.tlversion.number > 2008 ? '--self' : 'texlive.infra');
    }
    if (
      (options.reinstallForciblyRemoved ?? false)
      // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
      && this.tlversion.number >= 2009
    ) {
      args.unshift('--reinstall-forcibly-removed');
    }
    await exec('tlmgr', ['update', ...args]);
  }

  async version(this: void): Promise<void> {
    await exec('tlmgr', ['--version']);
  }
}

export namespace Tlmgr {
  export class Conf {
    constructor(
      private readonly tlversion: Version,
      private readonly TEXDIR: string,
    ) {}

    texmf(key: keyof Texmf): Promise<string>;
    texmf(
      key: keyof Texmf.UserTrees | 'TEXMFLOCAL',
      value: string,
    ): Promise<void>;
    async texmf(key: keyof Texmf, value?: string): Promise<string | void> {
      if (value === undefined) {
        const { stdout } = await getExecOutput(
          'kpsewhich',
          ['-var-value', key],
          { silent: true },
        );
        return stdout.trim();
      }
      // `tlmgr conf` is not implemented prior to 2010.
      if (this.tlversion.number < 2010) {
        exportVariable(key, value);
      } else {
        await exec('tlmgr', ['conf', 'texmf', key, value]);
      }
      // Unlike user directories,
      // system directories should be initialized at a minimum.
      if (key === 'TEXMFLOCAL') {
        try {
          await tlpkg.makeLocalSkeleton(value, { TEXDIR: this.TEXDIR });
          await exec('mktexlsr', [value]);
        } catch (cause) {
          log.info('Failed to initialize TEXMFLOCAL', { cause });
        }
      }
    }
  }

  export class Path {
    constructor(private readonly TEXDIR: string) {}

    async add(): Promise<void> {
      let dir: string;
      try {
        dir = await determine(path.join(this.TEXDIR, 'bin', '*'));
      } catch (cause) {
        throw new Error("Unable to locate TeX Live's binary directory", {
          cause,
        });
      }
      addPath(dir);
    }
  }

  export class Pinning {
    constructor({ number: tlversion }: Version) {
      if (tlversion < 2013) {
        throw new RangeError(
          `\`pinning\` action is not implemented in TeX Live ${tlversion}`,
        );
      }
    }

    async add(
      this: void,
      repo: string,
      ...globs: readonly [string, ...Array<string>]
    ): Promise<void> {
      await exec('tlmgr', ['pinning', 'add', repo, ...globs]);
    }
  }

  export class Repository {
    constructor({ number: tlversion }: Version) {
      if (tlversion < 2012) {
        throw new RangeError(
          `\`repository\` action is not implemented in TeX Live ${tlversion}`,
        );
      }
    }

    async add(this: void, repo: string, tag?: string): Promise<void> {
      const args = ['repository', 'add', repo];
      if (tag !== undefined) {
        args.push(tag);
      }
      const { exitCode, stderr } = await getExecOutput('tlmgr', args, {
        ignoreReturnCode: true,
      });
      if (
        // `tlmgr repository add` returns non-zero status code
        // if the same repository or tag is added again.
        // (todo:  make sure that the tagged repo is really tlcontrib)
        exitCode !== 0
        && !stderr.includes('repository or its tag already defined')
      ) {
        throw new Error(`tlmgr exited with ${exitCode}: ${stderr}`);
      }
    }
  }

  export interface UpdateOptions {
    readonly all?: boolean;
    readonly self?: boolean;
    readonly reinstallForciblyRemoved?: boolean;
  }
}
