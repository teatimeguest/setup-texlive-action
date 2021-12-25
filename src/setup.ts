import * as crypto from 'crypto';
import * as os from 'os';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import { Environment, InstallTL, Profile } from '#/install-tl';
import * as tl from '#/texlive';

export async function run(): Promise<void> {
  try {
    if (!context.getPost()) {
      await main();
      context.setPost();
    } else {
      await post();
    }
  } catch (error) {
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(`The action failed: ${error.stack}`);
    }
    core.setFailed(`${error}`);
  }
}

type CacheType = 'primary' | 'secondary' | 'none';

async function main(): Promise<void> {
  const config = await context.loadConfig();
  const profile = new Profile(config.version, config.prefix);
  let cacheType: CacheType = 'none';

  if (config.cache) {
    cacheType = await core.group('Restoring cache', async () => {
      const keys = getCacheKeys(config.version, config.packages);
      return await restoreCache(profile.TEXDIR, ...keys);
    });
  }

  const env = Environment.get(config.version);
  await core.group('Environment variables', async () => {
    core.info(env.toString());
  });

  if (cacheType === 'none') {
    const installtl = await core.group(
      'Acquiring install-tl',
      async () => await InstallTL.download(config.version),
    );
    await core.group('Profile', async () => {
      core.info(profile.toString());
    });
    await core.group('Installing Tex Live', async () => {
      await installtl.run(profile, env);
    });
  }

  const tlmgr = new tl.Manager(config.version, config.prefix);
  await tlmgr.path.add();

  if (cacheType !== 'none') {
    context.setCacheHit();
    await core.group('Adjusting TEXMF', async () => {
      const texmf = await tlmgr.conf.texmf();
      for (const key of tl.Texmf.keys()) {
        const value = env[`TEXLIVE_INSTALL_${key}`];
        if (value !== texmf[key]) {
          // eslint-disable-next-line no-await-in-loop
          await tlmgr.conf.texmf(key, value);
        }
      }
    });
  }

  if (config.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tl.contrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType === 'primary') {
    return;
  }

  if (config.packages.size !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(config.packages);
    });
  }
}

async function post(): Promise<void> {
  const config = await context.loadConfig();
  const profile = new Profile(config.version, config.prefix);
  const primaryKey = context.getKey();

  if (primaryKey === undefined) {
    core.info('Nothing to do');
    return;
  }

  await saveCache(profile.TEXDIR, primaryKey);
}

async function saveCache(texdir: string, primaryKey: string): Promise<void> {
  try {
    await cache.saveCache([texdir], primaryKey);
    core.info(`Cache saved`);
  } catch (error) {
    core.warning(`${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
}

async function restoreCache(
  texdir: string,
  primaryKey: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  restoreKeys: Array<string>,
): Promise<CacheType> {
  let key: string | undefined = undefined;
  try {
    key = await cache.restoreCache([texdir], primaryKey, restoreKeys);
    if (key === undefined) {
      core.info('Cache not found');
    }
  } catch (error) {
    core.info(`Failed to restore cache: ${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
  if (key === primaryKey) {
    return 'primary';
  }
  context.setKey(primaryKey);
  return key === undefined ? 'none' : 'secondary';
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
