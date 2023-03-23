import { isNativeError } from 'node:util/types';

import { getState, saveState, setFailed } from '@actions/core';
import { keys } from 'ts-transformer-keys';

import { CacheClient, save as saveCache } from '#/action/cache';
import { Inputs } from '#/action/inputs';
import { Outputs } from '#/action/outputs';
import * as log from '#/log';
import { Profile, Tlmgr, installTL, tlnet } from '#/texlive';
import type { UserTrees } from '#/texmf';

export async function run(): Promise<void> {
  const state = 'POST';
  try {
    if (getState(state) === '') {
      await main();
      saveState(state, '1');
    } else {
      await post();
    }
  } catch (error) {
    if (isNativeError(error)) {
      log.debug(error.stack);
      setFailed(error.message);
    } else {
      setFailed(`${error}`);
    }
  }
}

export async function main(): Promise<void> {
  const inputs = await Inputs.load();
  const outputs = new Outputs();
  outputs.version = inputs.version;

  const profile = new Profile(inputs);
  const cache = new CacheClient({
    TEXDIR: profile.TEXDIR,
    packages: inputs.packages,
    version: inputs.version,
  });
  let cacheInfo = { hit: false, full: false, restored: false };

  if (inputs.cache) {
    await log.group('Restoring cache', async () => {
      cacheInfo = await cache.restore();
    });
    outputs.cacheHit = cacheInfo.restored;
  }

  if (!cacheInfo.restored) {
    await log.group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await log.group('Installing TeX Live', async () => {
      await installTL(profile);
    });
  }

  const tlmgr = new Tlmgr(profile);
  await tlmgr.path.add();

  if (cacheInfo.restored) {
    await log.group('Updating tlmgr', async () => {
      try {
        await tlmgr.update([], { self: true });
      } catch (error) {
        const { stderr } = (error ?? {}) as Record<string, unknown>;
        if (
          cacheInfo.restored
          && typeof stderr === 'string'
          && stderr.includes('is older than remote repository')
        ) {
          const tag = 'main';
          const historic = tlnet.historic(inputs.version, { master: true });
          log.info(`Changing the ${tag} repository to ${historic}`);
          await tlmgr.repository.remove(tag);
          await tlmgr.repository.add(historic, tag);
          await tlmgr.update([], { self: true });
          cache.update();
        } else {
          throw error;
        }
      }
    });
    if (inputs.version.isLatest() && inputs.updateAllPackages) {
      await log.group(`Updating packages`, async () => {
        await tlmgr.update([], { all: true, reinstallForciblyRemoved: true });
      });
    }
    const entries = await Promise
      .all((['TEXMFLOCAL', ...keys<UserTrees>()] as const).map(async (key) => {
        const value = profile[key];
        const old = await tlmgr.conf.texmf(key);
        return old === value ? [] : [[key, value]] as const;
      }))
      .then((e) => e.flat());
    if (entries.length > 0) {
      await log.group('Adjusting TEXMF', async () => {
        for (const [key, value] of entries) {
          // eslint-disable-next-line no-await-in-loop
          await tlmgr.conf.texmf(key, value);
        }
      });
    }
  }

  if (inputs.tlcontrib) {
    await log.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlnet.CONTRIB, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (!cacheInfo.full && inputs.packages.size > 0) {
    await log.group('Installing packages', async () => {
      await tlmgr.install(inputs.packages);
    });
  }

  await log.group('TeX Live version info', async () => {
    await tlmgr.version();
    log.info('Package version:');
    for await (const { name, version, revision } of tlmgr.list()) {
      log.info(`  ${name}: ${version ?? `rev${revision}`}`);
    }
  });

  cache.saveState();
  outputs.emit();
}

export async function post(): Promise<void> {
  await saveCache();
}
