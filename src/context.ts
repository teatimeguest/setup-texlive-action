import * as fs from 'fs/promises';
import * as path from 'path';

import { isFeatureAvailable as isCacheAvailable } from '@actions/cache';
import * as core from '@actions/core';

import { Env } from './install-tl';
import { Version } from './texlive';
import * as util from './utility';

export interface Config {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly tlcontrib: boolean;
  readonly version: Version;
  readonly env: Readonly<Env>;
}

export async function loadConfig(): Promise<Config> {
  const cache = getCache();
  const packages = await getPackages();
  const version = getVersion();
  const env = new Env(version, path.join(util.tmpdir(), 'setup-texlive'));
  const prefix = getPrefix(env);
  const tlcontrib = getTlcontrib(version);
  return { cache, packages, prefix, tlcontrib, version, env };
}

function getCache(): boolean {
  const cache = core.getBooleanInput('cache');
  if (cache && !isCacheAvailable()) {
    core.warning('Caching is disabled because cache service is not available');
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

function getPrefix(env: Env): string {
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
