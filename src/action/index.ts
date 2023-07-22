import { isNativeError } from 'node:util/types';

import { getState, saveState, setFailed, setOutput } from '@actions/core';

import { CacheClient, save as saveCache } from '#/action/cache';
import { Inputs } from '#/action/inputs';
import type { Outputs } from '#/action/outputs';
import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import {
  Profile,
  TLVersionOutdated,
  type Tlmgr,
  type Version,
  installTL,
  latest,
  tlnet,
  useTlmgr,
} from '#/texlive';

export async function run(): Promise<void> {
  const state = 'POST';
  try {
    if (getState(state) === '') {
      const { cacheHit, version } = await main();
      saveState(state, '1');
      setOutput('cache-hit', cacheHit);
      setOutput('version', version);
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

export async function main(): Promise<Outputs> {
  const inputs = await Inputs.load();
  await using profile = new Profile(inputs.version, inputs);
  const cache = new CacheClient({
    TEXDIR: profile.TEXDIR,
    packages: inputs.packages,
    version: inputs.version,
  });
  let cacheInfo = { full: false, restored: false };

  if (inputs.cache) {
    await log.group('Restoring cache', async () => {
      cacheInfo = await cache.restore();
    });
  }

  if (!cacheInfo.restored) {
    await log.group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await log.group('Installing TeX Live', async () => {
      const repository = await latest.isLatest(inputs.version)
        ? await tlnet.ctan()
        : tlnet.historic(profile.version);
      log.info(`Main repository: ${repository}`);
      await installTL({ profile, repository });
    });
  }

  const tlmgr = useTlmgr(profile);
  await tlmgr.path.add();

  if (cacheInfo.restored) {
    await log.group('Updating tlmgr', async () => {
      try {
        await tlmgr.update({ self: true });
      } catch (error) {
        if (error instanceof TLVersionOutdated) {
          await updateRepository(tlmgr, inputs.version);
          cache.update();
        } else {
          throw error;
        }
      }
    });
    if (await latest.isLatest(inputs.version) && inputs.updateAllPackages) {
      await log.group(`Updating packages`, async () => {
        await tlmgr.update({ all: true, reinstallForciblyRemoved: true });
      });
    }
    await adjustTexmf(tlmgr, profile);
  }

  if (inputs.tlcontrib) {
    await log.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(await tlnet.contrib(), 'tlcontrib');
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
  return { cacheHit: cacheInfo.restored, version: inputs.version };
}

export async function post(): Promise<void> {
  await saveCache();
}

async function updateRepository(tlmgr: Tlmgr, version: Version): Promise<void> {
  const tag = 'main';
  const historic = tlnet.historic(version, { master: true });
  log.info(`Changing the ${tag} repository to ${historic}`);
  await tlmgr.repository.remove(tag);
  await tlmgr.repository.add(historic, tag);
  await tlmgr.update({ self: true });
}

async function adjustTexmf(tlmgr: Tlmgr, profile: Profile): Promise<void> {
  const keys = [
    'TEXMFLOCAL',
    ...Texmf.USER_TREES,
  ] as const satisfies ReadonlyArray<keyof Texmf>;
  const entries = await Promise
    .all(keys.map(async (key) => {
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
