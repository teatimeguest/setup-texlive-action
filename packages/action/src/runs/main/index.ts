import { setOutput } from '@actions/core';
import * as log from '@setup-texlive-action/logger';
import {
  Profile,
  ReleaseData,
  Tlmgr,
  tlnet,
} from '@setup-texlive-action/texlive';

import { CacheService } from '#action/cache';
import { Config } from '#action/runs/main/config';
import { install } from '#action/runs/main/install';
import { adjustTexmf, update } from '#action/runs/main/update';

export async function main(): Promise<void> {
  const config = await Config.load();
  const { latest, previous } = ReleaseData.use();
  await using profile = new Profile(config.version, config);

  using cache = CacheService.setup({
    TEXDIR: profile.TEXDIR,
    packages: config.packages,
    version: config.version,
  }, {
    enable: config.cache,
  });

  if (cache.enabled) {
    await log.group('Restoring cache', async () => {
      await cache.restore();
    });
  }

  if (!cache.restored) {
    await log.group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await log.group('Installing TeX Live', async () => {
      await install({ profile, repository: config.repository });
    });
  }

  const tlmgr = Tlmgr.setup(profile);
  await tlmgr.path.add();

  if (cache.restored) {
    if (profile.version >= previous.version) {
      const msg = config.updateAllPackages
        ? 'Updating packages'
        : profile.version >= latest.version
        ? 'Updating tlmgr'
        : 'Checking the package repository status';
      await log.group(msg, async () => {
        await update(config);
      });
    }
    await adjustTexmf(profile);
  }

  if (config.tlcontrib) {
    await log.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(await tlnet.contrib(), 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (!cache.hit && config.packages.size > 0) {
    await log.group('Installing packages', async () => {
      await tlmgr.install(config.packages);
    });
  }

  await log.group('TeX Live environment details', async () => {
    await tlmgr.version();
    log.info('Package versions:');
    for await (const { name, revision, cataloguedata } of tlmgr.list()) {
      log.info('  %s: %s', name, cataloguedata?.version ?? `rev${revision}`);
    }
  });

  cache.register();
  setOutput('version', config.version);
}
