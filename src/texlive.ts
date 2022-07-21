import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import { exec, getExecOutput as popen } from '@actions/exec';
import { cache as Cache } from 'decorator-cache-getter';
import type { DeepWritable } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { type Range, determine } from '#/utility';

export type Version = Range<'2008', `=${typeof Version.LATEST}`>;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace Version {
  export const LATEST = '2022' as const;

  export function isVersion(version: string): version is Version {
    const versions: ReadonlyArray<string> = keys<Record<Version, unknown>>();
    return versions.includes(version);
  }

  export function isLatest(version: Version): version is typeof LATEST {
    return version === LATEST;
  }

  export function validate(version: string): Version {
    if (isVersion(version)) {
      if (os.platform() === 'darwin' && version < '2013') {
        throw new RangeError(
          'Versions prior to 2013 does not work on 64-bit macOS',
        );
      }
      return version;
    }
    if (/^199[6-9]|200[0-7]$/u.test(version)) {
      throw new RangeError('Versions prior to 2008 are not supported');
    } else {
      throw new TypeError(`'${version}' is not a valid version`);
    }
  }
}

export interface Texmf {
  readonly ['TEXDIR']?: string;
  readonly ['TEXMFCONFIG']?: string;
  readonly ['TEXMFVAR']?: string;
  readonly ['TEXMFHOME']?: string;
  readonly ['TEXMFLOCAL']?: string;
  readonly ['TEXMFSYSCONFIG']?: string;
  readonly ['TEXMFSYSVAR']?: string;
}

export class Tlmgr {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  @Cache get conf(): Tlmgr.Conf {
    return new Tlmgr.Conf(this.version);
  }

  async install(this: void, ...packages: ReadonlyArray<string>): Promise<void> {
    if (packages.length !== 0) {
      Tlmgr.check((await popen('tlmgr', ['install', ...packages])).stderr);
    }
  }

  @Cache get path(): Tlmgr.Path {
    return new Tlmgr.Path(this.version, this.prefix);
  }

  @Cache get pinning(): Tlmgr.Pinning {
    return new Tlmgr.Pinning(this.version);
  }

  @Cache get repository(): Tlmgr.Repository {
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
        return (await popen('kpsewhich', ['-var-value', key])).stdout.trim();
      }
      // `tlmgr conf` is not implemented prior to 2010.
      if (this.version < '2010') {
        core.exportVariable(key, value);
      } else {
        await exec('tlmgr', ['conf', 'texmf', key, value]);
      }
    }
  }

  export class Path {
    readonly #pattern: string;
    constructor(version: Version, prefix: string) {
      this.#pattern = path.join(prefix, version, 'bin', '*');
    }

    async add(): Promise<void> {
      const dir = await determine(this.#pattern);
      if (dir === undefined) {
        throw new Error("Unable to locate TeX Live's binary directory");
      }
      core.addPath(dir);
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
      const { exitCode, stderr } = await popen('tlmgr', args, {
        ignoreReturnCode: true,
      });
      const status = exitCode === 0;
      if (
        // `tlmgr repository add` returns non-zero status code
        // if the same repository or tag is added again.
        // (todo:  make sure that the tagged repo is really tlcontrib)
        !status &&
        !stderr.includes('repository or its tag already defined')
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

  export function check(stderr: string): void {
    // tlpkg/TeXLive/TLUtils.pm
    const result = /: checksums differ for (.*):$/mu.exec(stderr);
    if (result !== null) {
      const pkg = path.basename(result[1] ?? '', '.tar.xz');
      throw new Error(
        `The checksum of package ${pkg} did not match. ` +
          'The CTAN mirror may be in the process of synchronization, ' +
          'please rerun the job after some time.',
      );
    }
  }
}

export function contrib(): URL {
  return new URL('https://mirror.ctan.org/systems/texlive/tlcontrib/');
}

export function historic(version: Version): URL {
  return new URL(
    version < '2010' ? 'tlnet/' : 'tlnet-final/',
    `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`,
  );
}

/**
 * Type for DEPENDS.txt.
 */
export type DependsTxt = ReadonlyMap<
  string,
  {
    readonly hard: ReadonlySet<string>;
    readonly soft: ReadonlySet<string>;
  }
>;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace DependsTxt {
  export function parse(txt: string): DependsTxt {
    const manifest: DeepWritable<DependsTxt> = new Map();
    const hardOrSoft = /^\s*(?:(soft|hard)(?=\s|$))?(.*)$/gmu;
    for (const [name, chunk] of eachPackage(txt.replace(/\s*#.*$/gmu, ''))) {
      if (!manifest.has(name)) {
        manifest.set(name, { hard: new Set(), soft: new Set() });
      }
      type Kind = keyof NonNullable<ReturnType<DependsTxt['get']>>;
      for (const [, kind = 'hard', args = ''] of chunk.matchAll(hardOrSoft)) {
        for (const dependency of args.split(/\s+/u).filter((s) => s !== '')) {
          manifest.get(name)?.[kind as Kind].add(dependency);
        }
      }
    }
    return manifest;
  }

  // eslint-disable-next-line no-inner-declarations
  function* eachPackage(txt: string): Generator<[string, string], void> {
    const [chunk = '', ...rest] = txt.split(/^\s*package(?=\s|$)(.*)$/mu);
    yield ['', chunk];
    for (let i = 0; i < rest.length; ++i) {
      let name = (rest[i] ?? '').trim();
      if (name === '' || /\s/u.test(name)) {
        log.warn(
          '`package` directive must have exactly one argument, ' +
            `but given ${name.length}: ${name}`,
        );
        name = '';
      }
      yield [name, rest[++i] ?? ''];
    }
  }
}
