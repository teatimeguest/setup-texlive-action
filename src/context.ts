import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { Exclude, Expose, deserialize } from 'class-transformer';
import { cache as Cache } from 'decorator-cache-getter';
import type { PickProperties } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import * as log from '#/log';
import { DependsTxt, Version } from '#/texlive';
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
      const list = core.getInput('packages').split(/(?:#.*$|\s+)/mu);
      const file = core.getInput('package-file');
      if (file !== '') {
        const contents = await fs.readFile(file, 'utf8');
        for (const { hard, soft } of DependsTxt.parse(contents).values()) {
          list.push(...hard, ...soft);
        }
      }
      return new Set(list.filter(Boolean).sort());
    })();
  }

  @Cache
  get prefix(): string {
    const input = core.getInput('prefix');
    if (input !== '') {
      return path.normalize(input);
    }
    return path.normalize(
      process.env['TEXLIVE_INSTALL_PREFIX']
        ?? path.join(tmpdir(), 'setup-texlive'),
    );
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
      log.warn('`update-all-packages` is ignored for older versions');
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
    try {
      return Version.validate(input);
    } catch (error) {
      throw new TypeError(
        `Version must be specified by year or 'latest': Caused by ${error}`,
      );
    }
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
  readonly TEXLIVE_INSTALL_PREFIX?: string;
  readonly TEXLIVE_INSTALL_TEXDIR: never;
  readonly TEXLIVE_INSTALL_TEXMFCONFIG: string;
  readonly TEXLIVE_INSTALL_TEXMFVAR: string;
  readonly TEXLIVE_INSTALL_TEXMFHOME: string;
  readonly TEXLIVE_INSTALL_TEXMFLOCAL: never;
  readonly TEXLIVE_INSTALL_TEXMFSYSCONFIG: never;
  readonly TEXLIVE_INSTALL_TEXMFSYSVAR: never;
  readonly NOPERLDOC?: string;
}

export namespace Env {
  export function get(version: Version): Env {
    for (const key of keys<PickProperties<Env, never>>() as Array<keyof Env>) {
      if (key in process.env) {
        log.warn(`\`${key}\` is set, but ignored`);
        delete process.env[key];
      }
    }
    const home = os.homedir();
    const texdir = path.join(home, '.local', 'texlive', version);
    for (
      const [key, value] of Object.entries({
        TEXLIVE_INSTALL_ENV_NOCHECK: '1',
        TEXLIVE_INSTALL_NO_WELCOME: '1',
        TEXLIVE_INSTALL_TEXMFCONFIG: path.join(texdir, 'texmf-config'),
        TEXLIVE_INSTALL_TEXMFVAR: path.join(texdir, 'texmf-var'),
        TEXLIVE_INSTALL_TEXMFHOME: path.join(home, 'texmf'),
      })
    ) {
      process.env[key] ??= value;
    }
    return process.env as unknown as Env;
  }
}

@Exclude()
export class State extends Serializable {
  @Expose()
  key?: string;
  @Expose()
  texdir?: string;

  save(): void {
    core.saveState('post', JSON.stringify(this.validate()));
    if (this.filled()) {
      log.info(`Cache key: ${this.key})`);
    }
  }

  filled(this: Readonly<this>): this is Required<State> {
    return this.key !== undefined && this.texdir !== undefined;
  }

  private validate(this: Readonly<this>): this {
    if ((this.key === undefined) !== (this.texdir === undefined)) {
      throw new Error(`Unexpected action state: ${this}`);
    }
    return this;
  }

  static load(): State | null {
    const post = core.getState('post');
    return post === '' ? null : deserialize(State, post).validate();
  }
}

/* eslint @typescript-eslint/naming-convention: off */
