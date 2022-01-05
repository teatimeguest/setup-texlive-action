import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import { keys } from 'ts-transformer-keys';

import { Env } from './install-tl';
import { Version } from './texlive';
import * as util from './utility';

export interface Config {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly tlcontrib: boolean;
  readonly version: Version;
  readonly env: Readonly<
    Env & {
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: string;
      ['TEXLIVE_INSTALL_NO_WELCOME']: string;
      ['TEXLIVE_INSTALL_PREFIX']: string;
      ['TEXLIVE_INSTALL_TEXMFHOME']: string;
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: string;
      ['TEXLIVE_INSTALL_TEXMFVAR']: string;
    }
  >;
}

export async function loadConfig(): Promise<Config> {
  const cache = getCache();
  const packages = await getPackages();
  const version = getVersion();
  const env = getEnv(version);
  const prefix = getPrefix(env);
  const tlcontrib = getTlcontrib(version);
  return { cache, packages, prefix, tlcontrib, version, env };
}

function getCache(): boolean {
  const cache = core.getBooleanInput('cache');
  /**
   * @see {@link https://github.com/actions/toolkit/blob/main/packages/cache/}
   */
  const urls = ['ACTIONS_CACHE_URL', 'ACTIONS_RUNTIME_URL'] as const;
  if (cache && urls.every((url) => !Boolean(process.env[url]))) {
    core.warning(
      `Caching is disabled because neither \`${urls[0]}\` nor \`${urls[1]}\` is defined`,
    );
    return false;
  }
  return cache;
}

async function getPackages(): Promise<Set<string>> {
  const inline = core.getInput('packages');
  const filename = core.getInput('package-file');
  const file = filename === '' ? '' : await fs.readFile(filename, 'utf8');
  const packages = new Set(
    [inline, file].flatMap((content) => content.split(/(?:#.*$|\s+)/mu)).sort(),
  );
  packages.delete('');
  return packages;
}

function getPrefix(env: Config['env']): string {
  const prefix = core.getInput('prefix');
  return prefix === '' ? env.TEXLIVE_INSTALL_PREFIX : prefix;
}

function getTlcontrib(version: Version): boolean {
  const tlcontrib = core.getBooleanInput('tlcontrib');
  if (tlcontrib && version !== Version.LATEST) {
    core.warning(
      '`tlcontrib` is ignored since an older version of TeX Live is specified',
    );
    return false;
  }
  return tlcontrib;
}

function getVersion(): Version {
  const version = core.getInput('version');
  if (Version.isVersion(version)) {
    return version;
  } else if (version === 'latest') {
    return Version.LATEST;
  }
  throw new TypeError("`version` must be specified by year or 'latest'");
}

function getEnv(version: Version): Config['env'] {
  const env = {} as { -readonly [K in keyof Config['env']]: string };
  for (const key of keys<Env>()) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  const home = os.homedir();
  const texdir = path.join(home, '.local', 'texlive', version);
  env.TEXLIVE_INSTALL_ENV_NOCHECK ??= 'true';
  env.TEXLIVE_INSTALL_NO_WELCOME ??= 'true';
  env.TEXLIVE_INSTALL_PREFIX ??= path.join(util.tmpdir(), 'setup-texlive');
  env.TEXLIVE_INSTALL_TEXMFHOME ??= path.join(home, 'texmf');
  env.TEXLIVE_INSTALL_TEXMFCONFIG ??= path.join(texdir, 'texmf-config');
  env.TEXLIVE_INSTALL_TEXMFVAR ??= path.join(texdir, 'texmf-var');
  return env;
}

export function getKey(): string | undefined {
  const key = core.getState('key');
  return key === '' ? undefined : key;
}

export function setKey(key: string): void {
  core.saveState('key', key);
}

export function getPost(): boolean {
  return core.getState('post') === 'true';
}

export function setPost(post: true = true): void {
  core.saveState('post', post);
}

export function setCacheHit(cacheHit: true = true): void {
  core.setOutput('cache-hit', cacheHit);
}
