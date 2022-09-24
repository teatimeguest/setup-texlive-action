import { platform } from 'node:os';
import path from 'node:path';

import { addPath, exportVariable } from '@actions/core';
import { exec, getExecOutput as spawn } from '@actions/exec';
import { HttpClient, HttpCodes } from '@actions/http-client';
import { cache as Cache } from 'decorator-cache-getter';
import type { Writable } from 'ts-essentials';

import * as log from '#/log';
import { determine } from '#/utility';

export class Version {
  constructor(private readonly spec: string) {
    if (/^199[6-9]|200[0-7]$/u.test(spec)) {
      throw new RangeError('Versions prior to 2008 are not supported');
    } else if (/^20\d\d$/u.test(spec) && spec <= Version.LATEST) {
      if (platform() === 'darwin' && spec < '2013') {
        throw new RangeError(
          'Versions prior to 2013 does not work on 64-bit macOS',
        );
      }
    } else if (spec !== 'latest') {
      throw new TypeError(`'${spec}' is not a valid version spec`);
    }
  }

  @Cache
  get number(): number {
    return Number.parseInt(this.toString());
  }

  isLatest(): boolean {
    return this.spec === 'latest' || this.toString() === Version.LATEST;
  }

  toString(): string {
    return this.spec === 'latest' ? Version.LATEST : this.spec;
  }

  toJSON(): string {
    return this.toString();
  }

  [Symbol.toPrimitive](hint: string): number | string {
    return hint === 'number' ? this.number : this.toString();
  }

  private static latest: string = '2022';

  static get LATEST(): string {
    return this.latest;
  }

  static async checkLatest(this: void): Promise<string> {
    interface Json {
      version?: { number?: string };
    }
    const endpoint = 'https://ctan.org/json/2.0/pkg/texlive';
    const http = new HttpClient();
    const { result, statusCode } = await http.getJson<Json>(endpoint);
    if (statusCode === HttpCodes.NotFound) {
      throw new Error(`${endpoint} returned ${HttpCodes.NotFound}`);
    }
    const latest = result?.version?.number ?? '';
    if (!/^20\d\d$/u.test(latest)) {
      throw new TypeError(`Invalid response: ${JSON.stringify(result)}`);
    }
    return Version.latest = latest;
  }

  static async resolve(this: void, spec: string): Promise<Version> {
    if (Date.now() > Date.UTC(Number.parseInt(Version.LATEST) + 1, 4, 1)) {
      try {
        log.info('Checking for the latest version of TeX Live');
        log.info(`Latest version: ${await Version.checkLatest()}`);
      } catch (cause) {
        log.info('Failed to check for the latest version', { cause });
        log.info(
          `Instead ${Version.LATEST} will be used as the latest version`,
        );
      }
    }
    return new Version(spec);
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
      if (this.version.number === 2008) {
        // tlmgr for TeX Live 2008 does not have `self` option
        packages = ['texlive.infra', ...packages];
      } else {
        args.push('--self');
      }
    }
    if (
      (options.reinstallForciblyRemoved ?? false)
      // `--reinstall-forcibly-removed` was first implemented in TeX Live 2009.
      && this.version.number >= 2009
    ) {
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
      if (this.version.number < 2010) {
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
    constructor({ number: version }: Version) {
      if (version < 2013) {
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
    constructor({ number: version }: Version) {
      if (version < 2012) {
        throw new RangeError(
          `\`repository\` action is not implemented in TeX Live ${version}`,
        );
      }
    }

    /**
     * @returns `false` if the repository already exists, otherwise `true`.
     */
    async add(this: void, repo: string, tag?: string): Promise<void> {
      const args = ['repository', 'add', repo];
      if (tag !== undefined) {
        args.push(tag);
      }
      const { exitCode, stderr } = await spawn('tlmgr', args, {
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
  export const CTAN = new URL('https://mirror.ctan.org/systems/texlive/tlnet/');

  export const CONTRIB = new URL(
    'https://mirror.ctan.org/systems/texlive/tlcontrib/',
  );

  export function historic({ number: version }: Version): URL {
    return new URL(
      version < 2010 ? 'tlnet/' : 'tlnet-final/',
      `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`,
    );
  }
}

/**
 * Type for DEPENDS.txt.
 */
export class DependsTxt {
  private readonly bundle = new Map<
    DependsTxt.Entry[0],
    Writable<DependsTxt.Entry[1]>
  >();

  constructor(txt: string) {
    txt = txt.replaceAll(/\s*#.*$/gmu, ''); // remove comments
    for (const [name, deps] of DependsTxt.unbundle(txt)) {
      let module = this.bundle.get(name);
      if (module === undefined) {
        module = {};
        this.bundle.set(name, module);
      }
      for (const [type, dep] of deps) {
        (module[type] ??= new Set()).add(dep);
      }
    }
  }

  get(name: string): DependsTxt.Entry[1] | undefined {
    return this.bundle.get(name);
  }

  [Symbol.iterator](): Iterator<DependsTxt.Entry, void, void> {
    return this.bundle.entries();
  }

  private static *unbundle(
    txt: string,
  ): Iterable<[string, ReturnType<typeof this.parse>]> {
    const [globals, ...rest] = txt.split(/^\s*package(?=\s|$)(.*)$/mu);
    yield ['', this.parse(globals)];
    const iter: Iterable<string> & Iterator<string, undefined> = rest.values();
    for (let name of iter) {
      name = name.trim();
      if (name === '' || /\s/u.test(name)) {
        log.warn(
          '`package` directive must have exactly one argument, but given: '
            + name,
        );
        name = '';
      }
      yield [name, this.parse(iter.next().value)];
    }
  }

  private static *parse(
    this: void,
    txt?: string,
  ): Iterable<[DependsTxt.DependencyType, string]> {
    const hardOrSoft = /^\s*(?:(soft|hard)(?=\s|$))?(.*)$/gmu;
    for (const [, type = 'hard', deps] of txt?.matchAll(hardOrSoft) ?? []) {
      for (const dep of deps?.split(/\s+/u).filter(Boolean) ?? []) {
        yield [type as DependsTxt.DependencyType, dep];
      }
    }
  }
}

export namespace DependsTxt {
  export type DependencyType = 'hard' | 'soft';
  export type Entry = [
    string,
    { readonly [T in DependencyType]?: Set<string> },
  ];
}
