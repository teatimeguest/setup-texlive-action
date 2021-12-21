import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import { InstallTL, Environment } from '#/install-tl';
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
  const config = await context.loadConfig();
  const texdir = path.join(config.prefix, config.version);
  const [primaryKey, restoreKeys] = getCacheKeys(
    config.version,
    config.packages,
  );

  let cacheKey: string | undefined = undefined;

  if (config.cache) {
    cacheKey = await core.group('Restoring cache', async () => {
      try {
        const key = await cache.restoreCache([texdir], primaryKey, restoreKeys);
        if (key === undefined) {
          core.info('Cache not found');
        }
        return key;
      } catch (error) {
        core.info(`Failed to restore cache: ${error}`);
        if (error instanceof Error && error.stack !== undefined) {
          core.debug(error.stack);
        }
        return undefined;
      }
    });
  }

  if (cacheKey === undefined) {
    const installtl = await core.group(
      'Acquiring install-tl',
      async () => await InstallTL.download(config.version),
    );
    await core.group('Installing Tex Live', async () => {
      await installtl.run(config.prefix);
    });
  }

  const tlmgr = new tl.Manager(config.version, config.prefix);
  await tlmgr.path.add();

  if (Boolean(cacheKey)) {
    context.setCacheHit();
    await core.group('Configuring TEXMF', async () => {
      const env = Environment.get(config.version);
      for (const variable of tl.TEXMF) {
        const value = env[`TEXLIVE_INSTALL_${variable}`];
        if (
          // eslint-disable-next-line no-await-in-loop
          value !== (await tlmgr.conf.texmf(variable)) &&
          value !== undefined
        ) {
          // eslint-disable-next-line no-await-in-loop
          await tlmgr.conf.texmf(variable, value);
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

  if (cacheKey === primaryKey) {
    return;
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
  const primaryKey = context.getKey();

  if (primaryKey === undefined) {
    core.info('Nothing to do');
    return;
  }

  const { version, prefix } = await context.loadConfig();
  const texdir = path.join(prefix, 'texlive', version);

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
