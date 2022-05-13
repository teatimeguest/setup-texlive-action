import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { keys } from 'ts-transformer-keys';

import type * as installtl from './install-tl';
import { Version } from './texlive';
import * as util from './utility';

export interface Context {
  readonly env: Readonly<Env>;
  readonly inputs: Readonly<Inputs>;
  readonly outputs: Readonly<Outputs>;
}

export namespace Context {
  export async function get(): Promise<Context> {
    const inputs = await Inputs.get();
    const outputs = Outputs.get();
    const env = Env.get(inputs.version);
    return { env, inputs, outputs };
  }
}

export interface Inputs {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly tlcontrib: boolean;
  readonly version: Version;
}

namespace Inputs {
  export async function get(): Promise<Inputs> {
    const re = /(?:#.*$|\s+)/mu;
    const packages = core.getInput('packages').split(re);
    const packageFile = core.getInput('package-file');
    if (packageFile !== '') {
      const contents = await fs.readFile(packageFile, 'utf8');
      packages.push(...contents.split(re));
    }
    const inputs = {
      cache: core.getBooleanInput('cache'),
      packages: new Set(packages.sort()),
      prefix: core.getInput('prefix'),
      tlcontrib: core.getBooleanInput('tlcontrib'),
      version: Version.LATEST,
    };
    inputs.packages.delete('');
    if (inputs.cache && !cache.isFeatureAvailable()) {
      core.warning('Caching is disabled since cache service is not available');
      inputs.cache = false;
    }
    if (inputs.prefix === '') {
      inputs.prefix =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        process.env['TEXLIVE_INSTALL_PREFIX'] ?? defaultPrefix();
    }
    const version = core.getInput('version');
    if (Version.isVersion(version)) {
      inputs.version = version;
    } else if (version !== 'latest') {
      throw new TypeError("version must be specified by year or 'latest'");
    }
    if (inputs.tlcontrib && inputs.version !== Version.LATEST) {
      core.warning('tlcontrib is ignored for an older version');
      inputs.tlcontrib = false;
    }
    return inputs;
  }
}

export interface Outputs {
  readonly cacheHit: () => void;
}

namespace Outputs {
  export function get(): Outputs {
    return {
      cacheHit: () => {
        core.setOutput('cache-hit', true);
      },
    };
  }
}

export interface Env {
  readonly ['TEXLIVE_DOWNLOADER']?: string;
  readonly ['TL_DOWNLOAD_PROGRAM']?: string;
  readonly ['TL_DOWNLOAD_ARGS']?: string;
  readonly ['TEXLIVE_INSTALL_ENV_NOCHECK']: string;
  readonly ['TEXLIVE_INSTALL_NO_CONTEXT_CACHE']?: string;
  readonly ['TEXLIVE_INSTALL_NO_RESUME']?: string;
  readonly ['TEXLIVE_INSTALL_NO_WELCOME']: string;
  readonly ['TEXLIVE_INSTALL_PAPER']?: string;
  readonly ['TEXLIVE_INSTALL_PREFIX']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFCONFIG']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFVAR']: string;
  readonly ['TEXLIVE_INSTALL_TEXMFHOME']: string;
  readonly ['NOPERLDOC']?: string;
}

namespace Env {
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

  export function defaults(version: Version): {
    [K in keyof Env as Env extends Record<K, Env[K]> ? K : never]: Env[K];
  } {
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
