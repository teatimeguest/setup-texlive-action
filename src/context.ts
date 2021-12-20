import { promises as fs } from 'fs';
import * as path from 'path';

import * as core from '@actions/core';

import * as tl from '#/texlive';
import * as util from '#/utility';

export interface Config {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly tlcontrib: boolean;
  readonly version: tl.Version;
}

export async function loadConfig(): Promise<Config> {
  const cache = getCache();
  const packages = await getPackages();
  const prefix = getPrefix();
  const version = getVersion();
  const tlcontrib = getTlcontrib(version);
  return { cache, packages, prefix, tlcontrib, version };
}

function getCache(): boolean {
  const cache = core.getBooleanInput('cache');
  /**
   * @see {@link https://github.com/actions/toolkit/blob/main/packages/cache/}
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const URLs = ['ACTIONS_CACHE_URL', 'ACTIONS_RUNTIME_URL'] as const;
  if (cache && URLs.every((url) => !Boolean(process.env[url]))) {
    core.warning(
      `Caching is disabled because neither \`${URLs[0]}\` nor \`${URLs[1]}\` is defined`,
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

function getPrefix(): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return [
    core.getInput('prefix'),
    process.env['TEXLIVE_INSTALL_PREFIX'],
    path.join(util.tmpdir(), 'setup-texlive'),
  ].find(Boolean)!;
}

function getTlcontrib(version: tl.Version): boolean {
  const tlcontrib = core.getBooleanInput('tlcontrib');
  if (tlcontrib && version !== tl.LATEST_VERSION) {
    core.warning(
      '`tlcontrib` is ignored since an older version of TeX Live is specified',
    );
    return false;
  }
  return tlcontrib;
}

function getVersion(): tl.Version {
  const version = core.getInput('version');
  if (tl.isVersion(version)) {
    return version;
  } else if (version === 'latest') {
    return tl.LATEST_VERSION;
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
