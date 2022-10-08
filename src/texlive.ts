import { platform } from 'node:os';
import path from 'node:path';

import { type ExecOutput } from '@actions/exec';
import { cache as Cache } from 'decorator-cache-getter';
import type { Writable } from 'ts-essentials';

import * as ctan from '#/ctan';
import * as log from '#/log';
import type { IterableIterator } from '#/utility';

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
    const pkg = await ctan.pkg('texlive');
    const latest = pkg.version?.number ?? '';
    if (!/^20\d\d$/u.test(latest)) {
      throw new TypeError(`Invalid response: ${JSON.stringify(pkg)}`);
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

export namespace tlpkg {
  export function check(output: string | Readonly<ExecOutput>): void {
    const stderr = typeof output === 'string' ? output : output.stderr;
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
    const iter: IterableIterator<string, undefined> = rest.values();
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
