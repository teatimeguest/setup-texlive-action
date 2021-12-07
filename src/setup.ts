import * as crypto from 'crypto';
import * as os from 'os';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import * as tl from '#/texlive';

export async function run(): Promise<void> {
  if (context.getPost()) {
    await saveCache();
  } else {
    await setup();
    context.setPost();
  }
}

function getCacheKeys(
  version: tl.Version,
  packages: ReadonlySet<string>,
): [string, Array<string>] {
  const digest = (s: string): string => {
    return crypto.createHash('sha256').update(s).digest('hex');
  };
  const baseKey = `setup-texlive-${os.platform()}-${os.arch()}-${version}-`;
  const primaryKey = `${baseKey}${digest(JSON.stringify([...packages]))}`;
  return [primaryKey, [baseKey]];
}

async function setup(): Promise<void> {
  const config = context.loadConfig();
  const tlmgr = new tl.Manager(config.version, config.prefix);
  const texdir = tlmgr.conf.texmf().texdir;
  const [primaryKey, restoreKeys] = getCacheKeys(
    config.version,
    config.packages,
  );

  let cacheKey: string | undefined = undefined;

  if (config.cache) {
    try {
      core.info('Restoring cache');
      cacheKey = await cache.restoreCache([texdir], primaryKey, restoreKeys);
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }
  }

  if (Boolean(cacheKey)) {
    context.setCacheHit();
    await tlmgr.path.add();
    if (cacheKey === primaryKey) {
      return;
    }
  } else {
    core.info('Cache not found');
    await tl.install(config.version, config.prefix);
  }

  if (config.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tl.tlcontrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (config.packages.size !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(config.packages);
    });
  }

  if (config.cache) {
    context.setKey(primaryKey);
  }
}

async function saveCache(): Promise<void> {
  const { version, prefix } = context.loadConfig();
  const tlmgr = new tl.Manager(version, prefix);
  const primaryKey = context.getKey();

  if (primaryKey === undefined) {
    core.info('Nothing to do');
    return;
  }

  try {
    await cache.saveCache([tlmgr.conf.texmf().texdir], primaryKey);
    core.info(`Cache saved`);
  } catch (error) {
    core.warning(`${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
}
