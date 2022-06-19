import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { Exclude, Expose, serialize, deserialize } from 'class-transformer';
import { cache as Cache } from 'decorator-cache-getter';
import type { RequiredKeys } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import type * as installtl from '#/install-tl';
import { DependsTxt, Version } from '#/texlive';
import * as util from '#/utility';

export class Inputs {
  @Cache get cache(): boolean {
    const input = core.getBooleanInput('cache');
    if (input && !cache.isFeatureAvailable()) {
      core.warning('Caching is disabled since cache service is not available');
      return false;
    }
    return input;
  }

  @Cache get packages(): Promise<Set<string>> {
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

  @Cache get prefix(): string {
    const input = core.getInput('prefix');
    if (input !== '') {
      return path.normalize(input);
    }
    return path.normalize(
      process.env['TEXLIVE_INSTALL_PREFIX'] ?? defaultPrefix(),
    );
  }

  @Cache get version(): Version {
    const input = core.getInput('version');
    if (Version.isVersion(input)) {
      return input;
    }
    if (input === 'latest') {
      return Version.LATEST;
    }
    throw new TypeError("version must be specified by year or 'latest'");
  }

  @Cache get tlcontrib(): boolean {
    const input = core.getBooleanInput('tlcontrib');
    if (input && !Version.isLatest(this.version)) {
      core.warning('tlcontrib is ignored for an older version');
      return false;
    }
    return input;
  }
}

export class Outputs {
  set ['cache-hit'](hit: true) {
    core.setOutput('cache-hit', hit);
  }
}

export interface Env {
  readonly ['TEXLIVE_DOWNLOADER']?: string;
  readonly ['TL_DOWNLOAD_PROGRAM']?: string;
  readonly ['TL_DOWNLOAD_ARGS']?: string;
  readonly ['TEXLIVE_INSTALL_ENV_NOCHECK']: string;
  readonly ['TEXLIVE_INSTALL_NO_CONTEXT_CACHE']?: string;
  readonly ['TEXLIVE_INSTALL_NO_DISKCHECK']?: string;
  readonly ['TEXLIVE_INSTALL_NO_RESUME']?: string;
  readonly ['TEXLIVE_INSTALL_NO_WELCOME']: string;
  readonly ['TEXLIVE_INSTALL_PAPER']?: string;
  readonly ['TEXLIVE_INSTALL_PREFIX']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFCONFIG']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFVAR']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFHOME']: string;
  readonly ['NOPERLDOC']?: string;
}

export namespace Env {
  export function get(version: Version): Env {
    for (const key of keys<Omit<installtl.Env, keyof Env>>()) {
      if (key in process.env) {
        core.warning(`${key} is set, but ignored`);
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(defaults(version))) {
      process.env[key] ??= value;
    }
    return process.env as unknown as Env;
  }

  export function defaults(version: Version): Pick<Env, RequiredKeys<Env>> {
    const home = os.homedir();
    const texdir = path.join(home, '.local', 'texlive', version);
    return {
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: '1',
      ['TEXLIVE_INSTALL_NO_WELCOME']: '1',
      ['TEXLIVE_INSTALL_PREFIX']: defaultPrefix(),
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: path.join(texdir, 'texmf-config'),
      ['TEXLIVE_INSTALL_TEXMFVAR']: path.join(texdir, 'texmf-var'),
      ['TEXLIVE_INSTALL_TEXMFHOME']: path.join(home, 'texmf'),
    };
  }
}

function defaultPrefix(): string {
  return path.join(util.tmpdir(), 'setup-texlive');
}

@Exclude()
export class State {
  @Expose() key?: string;
  @Expose() texdir?: string;

  save(): void {
    core.saveState('post', serialize(this.validate()));
  }

  filled(this: Readonly<this>): this is Required<State> {
    return this.key !== undefined && this.texdir !== undefined;
  }

  private validate(this: Readonly<this>): this {
    if ((this.key === undefined) !== (this.texdir === undefined)) {
      throw new Error(`Unexpected action state: ${serialize(this)}`);
    }
    return this;
  }

  static load(): State | null {
    const post = core.getState('post');
    if (post === '') {
      return null;
    }
    const state = deserialize(State, post);
    return state.validate();
  }
}
