import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { isFeatureAvailable as isCacheAvailable } from '@actions/cache';
import { getState, saveState, setOutput } from '@actions/core';
import { Expose, Type, plainToClassFromExist } from 'class-transformer';
import type { MarkRequired, MarkWritable, Writable } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { DependsTxt, type Texmf, Version } from '#/texlive';
import { Serializable, getInput, tmpdir } from '#/utility';

export interface Inputs {
  readonly cache: boolean;
  readonly forceUpdateCache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly texmf: MarkRequired<Partial<Texmf>, 'TEX_PREFIX'>;
  readonly tlcontrib: boolean;
  readonly updateAllPackages: boolean;
  readonly version: Version;
}

export namespace Inputs {
  export async function load(): Promise<Inputs> {
    const version = await Version.resolve(
      getInput('version', { default: 'latest' }),
    );
    const env = Env.load(version);
    const inputs = {
      cache: getInput('cache', { type: Boolean }),
      forceUpdateCache: (env.SETUP_TEXLIVE_FORCE_UPDATE_CACHE ?? '0') !== '0',
      packages: await loadPackageList(),
      texmf: loadTexmf(env),
      tlcontrib: getInput('tlcontrib', { type: Boolean }),
      updateAllPackages: getInput('update-all-packages', { type: Boolean }),
      version,
    };
    validate(inputs);
    return inputs;
  }

  function validate(
    this: void,
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    inputs: MarkWritable<Inputs, 'cache' | 'tlcontrib' | 'updateAllPackages'>,
  ): void {
    if (inputs.cache && !isCacheAvailable()) {
      log.warn('Caching is disabled because cache service is not available');
      inputs.cache = false;
    }
    if (!inputs.version.isLatest()) {
      if (inputs.tlcontrib) {
        log.warn('`tlcontrib` is currently ignored for older versions');
        inputs.tlcontrib = false;
      }
      if (inputs.updateAllPackages) {
        log.info('`update-all-packages` is ignored for older versions');
        inputs.updateAllPackages = false;
      }
    }
  }

  function loadTexmf(
    this: void,
    env: Env,
  ): MarkRequired<Partial<Texmf>, 'TEX_PREFIX'> {
    const texmf: Writable<Inputs['texmf']> = {
      TEX_PREFIX: path.normalize(
        getInput('prefix', { default: env.TEXLIVE_INSTALL_PREFIX }),
      ),
    };
    const texdir = getInput('texdir');
    if (texdir !== undefined) {
      texmf.TEXDIR = path.normalize(texdir);
    }
    if (env.TEXLIVE_INSTALL_TEXMFLOCAL !== undefined) {
      texmf.TEXMFLOCAL = path.normalize(env.TEXLIVE_INSTALL_TEXMFLOCAL);
    }
    for (const key of keys<Texmf.UserTrees>()) {
      texmf[key] = path.normalize(env[`TEXLIVE_INSTALL_${key}`]);
    }
    return texmf;
  }

  async function loadPackageList(this: void): Promise<Set<string>> {
    const packages = [];
    for await (const [, { hard = [], soft = [] }] of loadDependsTxt()) {
      packages.push(...hard, ...soft);
    }
    return new Set(packages.sort());
  }

  async function* loadDependsTxt(this: void): AsyncIterable<DependsTxt.Entry> {
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
  readonly TEXLIVE_INSTALL_TEXMFLOCAL?: string;
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
    type Keys = `TEXLIVE_INSTALL_${Exclude<
      keyof Texmf.SystemTrees,
      'TEXMFLOCAL'
    >}`;
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
