import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';

import * as tl from '#/texlive';

export interface Inputs {
  readonly cache: boolean;
  readonly packages: ReadonlyArray<string>;
  readonly prefix: string;
  readonly version: tl.Version;
}

export function getInputs(): Inputs {
  const inputs = {
    cache: core.getBooleanInput('cache'),
    packages: core.getInput('packages').split(/\s+/u).filter(Boolean).sort(),
    prefix: core.getInput('prefix'),
    version: tl.LATEST_VERSION,
  };

  /**
   * @see @link {https://github.com/actions/toolkit/blob/main/packages/cache/}
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const URLs = ['ACTIONS_CACHE_URL', 'ACTIONS_RUNTIME_URL'] as const;
  if (inputs.cache && URLs.every((url) => !Boolean(process.env[url]))) {
    inputs.cache = false;
    core.warning(
      `Caching is disabled because neither \`${URLs[0]}\` nor \`${URLs[1]}\` is defined`,
    );
  }

  if (inputs.prefix === '') {
    inputs.prefix =
      process.env['TEXLIVE_INSTALL_PREFIX'] ??
      path.join(
        os.platform() === 'win32' ? 'C:\\TEMP' : '/tmp',
        'setup-texlive',
      );
  }

  const version = core.getInput('version');
  if (version !== 'latest') {
    if (!tl.isVersion(version)) {
      throw new Error("`version` must be specified by year or 'latest'");
    }
    inputs.version = version;
  }

  return inputs;
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
