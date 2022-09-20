import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import path from 'node:path';

import { addPath, exportVariable } from '@actions/core';
import { exec, getExecOutput as spawn } from '@actions/exec';
import { cache as Cache } from 'decorator-cache-getter';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { type Range, determine } from '#/utility';

export type Version = Range<'2008', `=${typeof Version.LATEST}`>;

export namespace Version {
  export const LATEST = '2022' as const;

  export function isVersion(version: string): version is Version {
    const versions: ReadonlyArray<string> = keys<Record<Version, unknown>>();
    return versions.includes(version);
  }

  export function isLatest(version: Version): version is typeof LATEST {
    return version === LATEST;
  }

  export function validate(version: string): asserts version is Version {
    if (isVersion(version)) {
      if (platform() === 'darwin' && version < '2013') {
        throw new RangeError(
          'Versions prior to 2013 does not work on 64-bit macOS',
        );
      }
    } else {
      if (/^199[6-9]|200[0-7]$/u.test(version)) {
        throw new RangeError('Versions prior to 2008 are not supported');
      } else {
        throw new TypeError(`'${version}' is not a valid version`);
      }
    }
  }
}

export interface Texmf extends Texmf.SystemTrees, Texmf.UserTrees {}

export namespace Texmf {
  export interface SystemTrees {
    readonly TEXDIR: string;
    readonly TEXMFLOCAL: string;
    readonly TEXMFSYSCONFIG: string;
    readonly TEXMFSYSVAR: string;
  }

  export interface UserTrees {
    readonly TEXMFCONFIG: string;
    readonly TEXMFVAR: string;
    readonly TEXMFHOME: string;
  }
}

export class Tlmgr {
  constructor(
    private readonly version: Version,
    private readonly TEXDIR: string,
  ) {}

  @Cache
  get conf(): Tlmgr.Conf {
    return new Tlmgr.Conf(this.version);
  }

  async install(this: void, ...packages: ReadonlyArray<string>): Promise<void> {
    if (packages.length > 0) {
      const { stderr } = await spawn('tlmgr', ['install', ...packages]);
      tlpkg.check(stderr);
    }
  }

  @Cache
  get path(): Tlmgr.Path {
    return new Tlmgr.Path(this.TEXDIR);
  }

  @Cache
  get pinning(): Tlmgr.Pinning {
    return new Tlmgr.Pinning(this.version);
  }

  @Cache
  get repository(): Tlmgr.Repository {
    return new Tlmgr.Repository(this.version);
  }

  async update(
    packages: ReadonlyArray<string> = [],
    options: Readonly<Tlmgr.UpdateOptions> = {},
  ): Promise<void> {
    const args = ['update'];
    if (options.all ?? false) {
      args.push('--all');
    }
    if (options.self ?? false) {
      if (this.version === '2008') {
        // tlmgr for TeX Live 2008 does not have `self` option
        packages = ['texlive.infra', ...packages];
      } else {
        args.push('--self');
      }
    }
    // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
    if ((options.reinstallForciblyRemoved ?? false) && this.version >= '2009') {
      args.push('--reinstall-forcibly-removed');
    }
    await exec('tlmgr', [...args, ...packages]);
  }
}

export namespace Tlmgr {
  export class Conf {
    constructor(private readonly version: Version) {}

    texmf(key: keyof Texmf): Promise<string>;
    texmf(key: keyof Texmf, value: string): Promise<void>;
    async texmf(key: keyof Texmf, value?: string): Promise<string | void> {
      if (value === undefined) {
        const { stdout } = await spawn('kpsewhich', ['-var-value', key]);
        return stdout.trim();
      }
      // `tlmgr conf` is not implemented prior to 2010.
      if (this.version < '2010') {
        exportVariable(key, value);
      } else {
        await exec('tlmgr', ['conf', 'texmf', key, value]);
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
    constructor(version: Version) {
      if (version < '2013') {
        throw new RangeError(
          `\`pinning\` action is not implemented in TeX Live ${version}`,
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
    constructor(version: Version) {
      if (version < '2012') {
        throw new RangeError(
          `\`repository\` action is not implemented in TeX Live ${version}`,
        );
      }
    }

    /**
     * @returns `false` if the repository already exists, otherwise `true`.
     */
    async add(this: void, repo: string, tag?: string): Promise<boolean> {
      const args = ['repository', 'add', repo];
      if (tag !== undefined) {
        args.push(tag);
      }
      const { exitCode, stderr } = await spawn('tlmgr', args, {
        ignoreReturnCode: true,
      });
      const status = exitCode === 0;
      if (
        // `tlmgr repository add` returns non-zero status code
        // if the same repository or tag is added again.
        // (todo:  make sure that the tagged repo is really tlcontrib)
        !status
        && !stderr.includes('repository or its tag already defined')
      ) {
        throw new Error(
          `\`tlmgr\` failed with exit code ${exitCode}: ${stderr}`,
        );
      }
      return status;
    }
  }

  export interface UpdateOptions {
    all?: boolean;
    self?: boolean;
    reinstallForciblyRemoved?: boolean;
  }
}

export namespace tlpkg {
  export function check(stderr: string): void {
    // tlpkg/TeXLive/TLUtils.pm
    const result = /: checksums differ for (.*):$/mu.exec(stderr);
    if (result !== null) {
      const pkg = path.basename(result[1] ?? '', '.tar.xz');
      throw new Error(
        `The checksum of package ${pkg} did not match. `
          + 'The CTAN mirror may be in the process of synchronization, '
          + 'please rerun the job after some time.',
      );
    }
  }
}

export namespace tlnet {
  export function contrib(): URL {
    return new URL('https://mirror.ctan.org/systems/texlive/tlcontrib/');
  }

  export function historic(version: Version): URL {
    return new URL(
      version < '2010' ? 'tlnet/' : 'tlnet-final/',
      `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`,
    );
  }
}

/**
 * Type for DEPENDS.txt.
 */
export class DependsTxt {
  private readonly dependencies = new Map<string, DependsTxt.Dependencies>();

  constructor(txt: string) {
    for (const [name, chunk] of DependsTxt.eachPackage(txt)) {
      const deps = new DependsTxt.Dependencies(chunk);
      if (this.dependencies.get(name)?.merge(deps) === undefined) {
        this.dependencies.set(name, deps);
      }
    }
  }

  get(name: string): DependsTxt.Dependencies | undefined {
    return this.dependencies.get(name);
  }

  [Symbol.iterator](): Iterator<[string, DependsTxt.Dependencies], void, void> {
    return this.dependencies.entries();
  }

  private static *eachPackage(txt: string): Generator<[string, string], void> {
    const [chunk = '', ...rest] = txt
      .replaceAll(/\s*#.*$/gmu, '')
      .split(/^\s*package(?=\s|$)(.*)$/mu);
    yield ['', chunk];
    for (let i = 0; i < rest.length; ++i) {
      let name = (rest[i] ?? '').trim();
      if (name === '' || /\s/u.test(name)) {
        log.warn(
          '`package` directive must have exactly one argument, '
            + `but given ${name.length}: ${name}`,
        );
        name = '';
      }
      yield [name, rest[++i] ?? ''];
    }
  }

  static async fromFile(file: string): Promise<DependsTxt> {
    return new this(await readFile(file, 'utf8'));
  }
}

export namespace DependsTxt {
  export class Dependencies {
    readonly hard = new Set<string>();
    readonly soft = new Set<string>();

    constructor(txt: string) {
      const hardOrSoft = /^\s*(?:(soft|hard)(?=\s|$))?(.*)$/gmu;
      for (const [, directive, args = ''] of txt.matchAll(hardOrSoft)) {
        for (const dep of args.split(/\s+/u).filter(Boolean)) {
          (directive === 'soft' ? this.soft : this.hard).add(dep);
        }
      }
    }

    merge(other: Readonly<this>): this {
      other.hard.forEach((dep) => this.hard.add(dep));
      other.soft.forEach((dep) => this.soft.add(dep));
      return this;
    }
  }
}
