import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import * as cache from '@actions/cache';
import { getState, saveState, setOutput } from '@actions/core';
import { Expose, Type, plainToClassFromExist } from 'class-transformer';
import { cache as Cache } from 'decorator-cache-getter';
import type { MarkRequired, MarkWritable } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { DependsTxt, type Texmf, Version } from '#/texlive';
import { Serializable, getInput, tmpdir } from '#/utility';

export class Inputs {
  private readonly env: Env;

  readonly cache: boolean = getInput('cache', { type: Boolean });
  readonly tlcontrib: boolean = getInput('tlcontrib', { type: Boolean });
  readonly updateAllPackages: boolean = getInput('update-all-packages', {
    type: Boolean,
  });

  constructor(
    readonly packages: ReadonlySet<string>,
    readonly version: Version,
  ) {
    if (this.cache && !cache.isFeatureAvailable()) {
      log.warn('Caching is disabled because cache service is not available');
      this.cache = false;
    }
    if (this.tlcontrib && !this.version.isLatest()) {
      log.warn('`tlcontrib` is currently ignored for older versions');
      this.tlcontrib = false;
    }
    if (this.updateAllPackages && !this.version.isLatest()) {
      log.info('`update-all-packages` is ignored for older versions');
      this.updateAllPackages = false;
    }
    this.env = Env.load(this.version);
  }

  @Cache
  get texmf(): MarkRequired<Partial<Texmf>, 'TEX_PREFIX'> {
    const texmf: MarkWritable<Inputs['texmf'], 'TEXDIR'> = {
      TEX_PREFIX: path.normalize(
        getInput('prefix', { default: this.env.TEXLIVE_INSTALL_PREFIX }),
      ),
      TEXMFHOME: this.env.TEXLIVE_INSTALL_TEXMFHOME,
      TEXMFCONFIG: this.env.TEXLIVE_INSTALL_TEXMFCONFIG,
      TEXMFVAR: this.env.TEXLIVE_INSTALL_TEXMFVAR,
    };
    const texdir = getInput('texdir');
    if (texdir !== undefined) {
      texmf.TEXDIR = path.normalize(texdir);
    }
    return texmf;
  }

  get forceUpdateCache(): boolean {
    return (this.env.SETUP_TEXLIVE_FORCE_UPDATE_CACHE ?? '0') !== '0';
  }

  static async load(): Promise<Inputs> {
    return new Inputs(
      await this.loadPackageList(),
      await Version.resolve(getInput('version', { default: 'latest' })),
    );
  }

  private static async loadPackageList(): Promise<Set<string>> {
    const packages = [];
    for await (const [, { hard = [], soft = [] }] of this.loadDependsTxt()) {
      packages.push(...hard, ...soft);
    }
    return new Set(packages.sort());
  }

  private static async *loadDependsTxt(
    this: void,
  ): AsyncIterable<DependsTxt.Entry> {
    const inline = getInput('packages');
    if (inline !== undefined) {
      yield* new DependsTxt(inline);
    }
    const file = getInput('package-file');
    if (file !== undefined) {
      yield* new DependsTxt(await readFile(file, 'utf8'));
    }
  }
}

export class Outputs extends Serializable {
  @Expose({ name: 'cache-hit' })
  cacheHit: boolean = false;
  @Expose() @Type(() => String)
  version?: Version;

  emit(): void {
    for (const [key, value] of Object.entries(this.toJSON())) {
      setOutput(key, value);
    }
  }
}

export interface Env {
  readonly SETUP_TEXLIVE_FORCE_UPDATE_CACHE?: string;

  readonly TEXLIVE_DOWNLOADER?: string;
  readonly TL_DOWNLOAD_PROGRAM?: string;
  readonly TL_DOWNLOAD_ARGS?: string;
  readonly TEXLIVE_INSTALL_ENV_NOCHECK: string;
  readonly TEXLIVE_INSTALL_NO_CONTEXT_CACHE?: string;
  readonly TEXLIVE_INSTALL_NO_DISKCHECK?: string;
  readonly TEXLIVE_INSTALL_NO_RESUME?: string;
  readonly TEXLIVE_INSTALL_NO_WELCOME: string;
  readonly TEXLIVE_INSTALL_PAPER?: string;
  readonly TEXLIVE_INSTALL_PREFIX: string;
  readonly TEXLIVE_INSTALL_TEXMFCONFIG: string;
  readonly TEXLIVE_INSTALL_TEXMFVAR: string;
  readonly TEXLIVE_INSTALL_TEXMFHOME: string;
  readonly NOPERLDOC?: string;
}

export namespace Env {
  export function load(version: Version): Env {
    if (process.env['RUNNER_TEMP'] === undefined) {
      log.warn(`\`RUNNER_TEMP\` not defined, ${tmpdir()} will be used instead`);
      process.env['RUNNER_TEMP'] = tmpdir();
    }
    // Use RUNNER_TEMP as a temporary directory during setup.
    process.env['TMPDIR'] = process.env['RUNNER_TEMP'];
    type Keys = `TEXLIVE_INSTALL_${keyof Texmf.SystemTrees}`;
    for (const key of keys<Record<Keys, unknown>>()) {
      if (key in process.env) {
        log.warn(`\`${key}\` is set, but ignored`);
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(defaults(version))) {
      process.env[key] ??= value;
    }
    return process.env as Env;
  }

  export function defaults(version: Version): Env {
    const TEXUSERDIR = path.join(
      homedir(),
      '.local',
      'texlive',
      version.toString(),
    );
    return {
      TEXLIVE_INSTALL_ENV_NOCHECK: '1',
      TEXLIVE_INSTALL_NO_WELCOME: '1',
      TEXLIVE_INSTALL_PREFIX: path.join(tmpdir(), 'setup-texlive'),
      TEXLIVE_INSTALL_TEXMFHOME: path.join(homedir(), 'texmf'),
      TEXLIVE_INSTALL_TEXMFCONFIG: path.join(TEXUSERDIR, 'texmf-config'),
      TEXLIVE_INSTALL_TEXMFVAR: path.join(TEXUSERDIR, 'texmf-var'),
    };
  }
}

export class State extends Serializable {
  static readonly NAME = 'post';

  readonly post: boolean = false;
  @Expose()
  key?: string;
  @Expose()
  texdir?: string;

  constructor() {
    super();
    const state = getState(State.NAME);
    if (state !== '') {
      plainToClassFromExist(this, JSON.parse(state));
      this.post = true;
    }
  }

  save(): void {
    saveState(State.NAME, JSON.stringify(this));
  }
}
