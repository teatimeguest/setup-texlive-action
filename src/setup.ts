import * as crypto from 'crypto';
import * as os from 'os';

import * as core from '@actions/core';

import * as context from './context';
import { Env, InstallTL, Profile } from './install-tl';
import { contrib as tlcontrib, Manager, Version } from './texlive';
import * as util from './utility';

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

async function main(): Promise<void> {
  const config = await context.loadConfig();
  const profile = new Profile(config.version, config.prefix);
  let cacheType = undefined;

  if (config.cache) {
    const keys = getCacheKeys(config.version, config.packages);
    cacheType = await core.group('Restoring cache', async () => {
      return await util.restoreCache(profile.TEXDIR, ...keys);
    });
    if (cacheType !== 'primary') {
      context.setKey(keys[1][0]);
    }
  }

  await core.group('Environment variables for TeX Live', async () => {
    core.info(Env.format(config.env));
  });

  if (cacheType === undefined) {
    const installtl = await core.group('Acquiring install-tl', async () => {
      return await InstallTL.acquire(config.version);
    });
    await core.group('Installation profile', async () => {
      core.info(Profile.format(profile));
    });
    await core.group('Installing TeX Live', async () => {
      await installtl.run(profile, config.env);
    });
  }

  const tlmgr = new Manager(config.version, config.prefix);
  await tlmgr.path.add();

  if (cacheType !== undefined) {
    context.setCacheHit();
    await core.group('Adjusting TEXMF', async () => {
      for (const [key, value] of await tlmgr.conf.texmf()) {
        const specified = config.env[`TEXLIVE_INSTALL_${key}`];
        if (value !== specified) {
          // eslint-disable-next-line no-await-in-loop
          await tlmgr.conf.texmf(key, specified);
        }
      }
    });
  }

  if (config.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlcontrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType !== 'primary' && config.packages.size !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(...config.packages);
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

  await util.saveCache(profile.TEXDIR, primaryKey);
}

function getCacheKeys(
  version: Version,
  packages: ReadonlySet<string>,
): [string, [string]] {
  const digest = (s: string): string => {
    return crypto.createHash('sha256').update(s).digest('hex');
  };
  const baseKey = `setup-texlive-${os.platform()}-${os.arch()}-${version}-`;
  const primaryKey = `${baseKey}${digest(JSON.stringify([...packages]))}`;
  return [primaryKey, [baseKey]];
}
