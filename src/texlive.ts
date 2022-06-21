import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
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

/**
 * An interface for the `tlmgr` command.
 */
export class Manager {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  @Cache get conf(): {
    readonly texmf: {
      (key: keyof Texmf): Promise<string>;
      (key: keyof Texmf, value: string): Promise<void>;
    };
  } {
    function texmf(key: keyof Texmf): Promise<string>;
    function texmf(key: keyof Texmf, value: string): Promise<void>;
    async function texmf(
      this: { readonly version: Version },
      key: keyof Texmf,
      value?: string,
    ): Promise<string | void> {
      if (value === undefined) {
        return (
          await getExecOutput('kpsewhich', ['-var-value', key])
        ).stdout.trim();
      }
      // `tlmgr conf` is not implemented prior to 2010.
      if (this.version < '2010') {
        core.exportVariable(key, value);
      } else {
        await exec('tlmgr', ['conf', 'texmf', key, value]);
      }
    }
    return { texmf: texmf.bind({ version: this.version }) };
  }

  async install(this: void, ...packages: ReadonlyArray<string>): Promise<void> {
    if (packages.length !== 0) {
      await exec('tlmgr', ['install', ...packages]);
    }
  }

  @Cache get path(): {
    readonly add: () => Promise<void>;
  } {
    return {
      add: async () => {
        const binpath = await determine(
          path.join(this.prefix, this.version, 'bin', '*'),
        );
        if (binpath === undefined) {
          throw new Error("Unable to locate TeX Live's binary directory");
        }
        core.addPath(binpath);
      },
    };
  }

  @Cache get pinning(): {
    readonly add: (
      repo: string,
      ...globs: readonly [string, ...Array<string>]
    ) => Promise<void>;
  } {
    if (this.version < '2013') {
      throw new RangeError(
        `\`pinning\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, ...globs: ReadonlyArray<string>) => {
        await exec('tlmgr', ['pinning', 'add', repo, ...globs]);
      },
    };
  }

  @Cache get repository(): {
    /**
     * @returns `false` if the repository already exists, otherwise `true`.
     */
    readonly add: (repo: string, tag?: string) => Promise<boolean>;
  } {
    if (this.version < '2012') {
      throw new RangeError(
        `\`repository\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, tag?) => {
        const { exitCode, stderr } = await getExecOutput(
          'tlmgr',
          ['repository', 'add', repo, ...(tag === undefined ? [] : [tag])],
          { ignoreReturnCode: true },
        );
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
      },
    };
  }

  async update(
    packages: ReadonlyArray<string> = [],
    options: { readonly self?: true } = {},
  ): Promise<void> {
    const args = ['update'];
    if (options.self) {
      if (this.version === '2008') {
        // tlmgr for TeX Live 2008 does not have `self` option
        packages = ['texlive.infra', ...packages];
      } else {
        args.push('--self');
      }
    }
    await exec('tlmgr', [...args, ...packages]);
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
