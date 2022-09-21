import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import * as cache from '@actions/cache';
import {
  getBooleanInput,
  getInput,
  getState,
  saveState,
  setOutput,
} from '@actions/core';
import { Expose, plainToClassFromExist } from 'class-transformer';
import { cache as Cache } from 'decorator-cache-getter';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { DependsTxt, type Texmf, Version } from '#/texlive';
import { Serializable, tmpdir } from '#/utility';

export class Inputs {
  readonly cache: boolean = getBooleanInput('cache');
  readonly tlcontrib: boolean = getBooleanInput('tlcontrib');
  readonly updateAllPackages: boolean = getBooleanInput('update-all-packages');

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
  }

  @Cache
  get texmf(): Omit<Texmf, 'TEXMFSYSCONFIG' | 'TEXMFSYSVAR'> {
    const env = new Env(this.version);
    const input = getInput('prefix');
    const prefix = path.normalize(
      input !== '' ? input : env.TEXLIVE_INSTALL_PREFIX,
    );
    const TEXDIR = path.join(prefix, this.version.toString());
    return {
      TEXDIR,
      TEXMFLOCAL: path.join(prefix, 'texmf-local'),
      TEXMFHOME: env.TEXLIVE_INSTALL_TEXMFHOME,
      TEXMFCONFIG: env.TEXLIVE_INSTALL_TEXMFCONFIG,
      TEXMFVAR: env.TEXLIVE_INSTALL_TEXMFVAR,
    };
  }

  static async load(this: void): Promise<Inputs> {
    return new Inputs(
      await Inputs.loadPackages(),
      await Version.resolve(getInput('version')),
    );
  }

  private static async loadPackages(this: void): Promise<Set<string>> {
    // eslint-disable-next-line func-style
    const dependsTxt = async function*(): AsyncIterable<DependsTxt.Entry> {
      const inline = getInput('packages');
      if (inline !== '') {
        yield* new DependsTxt(inline);
      }
      const file = getInput('package-file');
      if (file !== '') {
        yield* new DependsTxt(await readFile(file, 'utf8'));
      }
    };
    const packages = [];
    for await (const [, { hard = [], soft = [] }] of dependsTxt()) {
      packages.push(...hard, ...soft);
    }
    return new Set(packages.sort());
  }
}

export class Outputs extends Serializable {
  @Expose({ name: 'cache-hit' })
  cacheHit: boolean = false;

  emit(): void {
    for (const [key, value] of Object.entries(this.toJSON())) {
      setOutput(key, value);
    }
  }
}

export interface Env {
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

export class Env {
  constructor(version: Version) {
    type Keys = `TEXLIVE_INSTALL_${keyof Texmf.SystemTrees}`;
    for (const key of keys<Record<Keys, unknown>>()) {
      if (key in process.env) {
        log.warn(`\`${key}\` is set, but ignored`);
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(Env.defaults(version))) {
      process.env[key] ??= value;
    }
    // eslint-disable-next-line no-constructor-return
    return process.env as unknown as Env;
  }

  static defaults(version: Version): Env {
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
