import { homedir } from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { Exclude, Expose, plainToClassFromExist } from 'class-transformer';
import { cache as Cache } from 'decorator-cache-getter';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { DependsTxt, type Texmf, Version } from '#/texlive';
import { Serializable, tmpdir } from '#/utility';

export class Inputs {
  @Cache
  get cache(): boolean {
    const input = core.getBooleanInput('cache');
    if (input && !cache.isFeatureAvailable()) {
      log.warn('Caching is disabled because cache service is not available');
      return false;
    }
    return input;
  }

  @Cache
  get packages(): Promise<Set<string>> {
    return (async () => {
      type Entry = [string, DependsTxt.Dependencies];
      async function* dependsTxt(): AsyncGenerator<Entry, void, void> {
        const inline = core.getInput('packages');
        if (inline !== '') {
          yield* new DependsTxt(inline);
        }
        const file = core.getInput('package-file');
        if (file !== '') {
          yield* await DependsTxt.fromFile(file);
        }
      }
      const list = [];
      for await (const [, { hard, soft }] of dependsTxt()) {
        list.push(...hard, ...soft);
      }
      return new Set(list.sort());
    })();
  }

  @Cache
  get texmf(): Omit<Texmf, 'TEXMFSYSCONFIG' | 'TEXMFSYSVAR'> {
    const env = new Env(this.version);
    const input = core.getInput('prefix');
    const prefix = path.normalize(
      input !== '' ? input : env.TEXLIVE_INSTALL_PREFIX,
    );
    const TEXDIR = path.join(prefix, this.version);
    return {
      TEXDIR,
      TEXMFLOCAL: path.join(prefix, 'texmf-local'),
      TEXMFHOME: env.TEXLIVE_INSTALL_TEXMFHOME,
      TEXMFCONFIG: env.TEXLIVE_INSTALL_TEXMFCONFIG,
      TEXMFVAR: env.TEXLIVE_INSTALL_TEXMFVAR,
    };
  }

  @Cache
  get tlcontrib(): boolean {
    const input = core.getBooleanInput('tlcontrib');
    if (input && !Version.isLatest(this.version)) {
      log.warn('`tlcontrib` is currently ignored for older versions');
      return false;
    }
    return input;
  }

  @Cache
  get updateAllPackages(): boolean {
    const input = core.getBooleanInput('update-all-packages');
    if (input && !Version.isLatest(this.version)) {
      log.info('`update-all-packages` is ignored for older versions');
      return false;
    }
    return input;
  }

  @Cache
  get version(): Version {
    const input = core.getInput('version');
    if (input === 'latest') {
      return Version.LATEST;
    }
    Version.validate(input);
    return input;
  }
}

@Exclude()
export class Outputs extends Serializable {
  @Expose()
  'cache-hit': boolean = false;

  emit(): void {
    for (const [key, value] of Object.entries(this.toJSON())) {
      core.setOutput(key, value);
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
    const TEXUSERDIR = path.join(homedir(), '.local', 'texlive', version);
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

@Exclude()
export class State extends Serializable {
  static readonly NAME = 'post';

  readonly post: boolean = false;
  @Expose()
  key?: string;
  @Expose()
  texdir?: string;

  constructor() {
    super();
    const state = core.getState(State.NAME);
    if (state !== '') {
      plainToClassFromExist(this, JSON.parse(state));
      this.post = true;
    }
  }

  save(): void {
    core.saveState(State.NAME, JSON.stringify(this));
  }
}

/* eslint @typescript-eslint/naming-convention: off */
