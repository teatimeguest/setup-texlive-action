import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as tl from '#/texlive';

export async function run(): Promise<void> {
  if (core.getState('post') === '') {
    await setup();
    core.saveState('post', true);
  } else {
    await saveCache();
  }
}

interface Inputs {
  readonly cache: boolean;
  readonly packages: Array<string>;
  readonly prefix: string;
  readonly version: tl.Version;
}

function getInputs(): Inputs {
  let cache = core.getBooleanInput('cache');

  if (
    cache &&
    /**
     * @see {@link https://github.com/actions/toolkit/blob/main/packages/cache/src/internal/cacheHttpClient.ts}
     */
    !process.env['ACTIONS_CACHE_URL'] &&
    !process.env['ACTIONS_RUNTIME_URL']
  ) {
    cache = false;
    core.info(
      'Caching is disabled because neither `ACTIONS_CACHE_URL` nor `ACTIONS_CACHE_URL` is defined',
    );
  }

  const packages = core
    .getInput('packages')
    .split(/\s+/)
    .filter((s) => s !== '')
    .sort();

  const prefix = [
    core.getInput('prefix'),
    process.env['TEXLIVE_INSTALL_PREFIX'],
    path.join(os.platform() === 'win32' ? 'C:\\TEMP' : '/tmp', 'setup-texlive'),
  ].find(Boolean) as string;

  let version = core.getInput('version');

  if (version === 'latest') {
    version = tl.LATEST_VERSION;
  } else if (!tl.isVersion(version)) {
    throw new Error("`version` must be specified by year or 'latest'");
  }

  return { cache, packages, prefix, version: version as tl.Version };
}

function getCacheKeys(
  version: tl.Version,
  packages: Array<string>,
): [string, Array<string>] {
  const digest = (s: string): string => {
    return crypto.createHash('sha256').update(s).digest('hex');
  };
  const baseKey = `setup-texlive-${os.platform()}-${os.arch()}-${version}-`;
  const primaryKey = `${baseKey}${digest(JSON.stringify(packages))}`;
  return [primaryKey, [baseKey]];
}

async function setup(): Promise<void> {
  const inputs = getInputs();
  const tlmgr = new tl.Manager(inputs.version, inputs.prefix);
  const texdir = tlmgr.conf().texdir;
  const [primaryKey, restoreKeys] = getCacheKeys(
    inputs.version,
    inputs.packages,
  );

  let cacheKey: string | undefined = undefined;

  if (inputs.cache) {
    try {
      cacheKey = await cache.restoreCache([texdir], primaryKey, restoreKeys);
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }
  }

  const cacheHit = Boolean(cacheKey);
  core.setOutput('cache-hit', cacheHit);

  if (cacheHit) {
    core.info('Cache restored');
    await tlmgr.pathAdd();
    if (cacheKey === primaryKey) {
      return;
    }
  } else {
    await tl.install(inputs.version, inputs.prefix, os.platform());
  }

  await core.group('Installing packages', async () => {
    await tlmgr.install(inputs.packages);
  });

  if (inputs.cache) {
    core.saveState('key', primaryKey);
  }
}

async function saveCache(): Promise<void> {
  const { version, prefix } = getInputs();
  const tlmgr = new tl.Manager(version, prefix);
  const primaryKey = core.getState('key');

  if (primaryKey === '') {
    core.info('Nothing to do');
    return;
  }

  try {
    await cache.saveCache([tlmgr.conf().texdir], primaryKey);
    core.info(`Cache saved`);
  } catch (error) {
    core.warning(`${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
}
