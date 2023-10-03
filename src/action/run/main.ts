import { setOutput } from '@actions/core';

import { CacheService } from '#/action/cache';
import { Config } from '#/action/config';
import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import {
  Profile,
  ReleaseData,
  TLVersionOutdated,
  Tlmgr,
  Version,
  installTL,
  tlnet,
} from '#/texlive';

export async function main(): Promise<void> {
  const config = await Config.load();
  const { isLatest } = ReleaseData.use();
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
      const repository = isLatest(profile.version)
        ? await tlnet.ctan()
        : tlnet.historic(profile.version);
      log.info('Main repository: %s', repository);
      await installTL({ profile, repository });
    });
  }

  const tlmgr = Tlmgr.setup(profile);
  await tlmgr.path.add();

  if (cache.restored) {
    await log.group(
      isLatest(profile.version)
        ? 'Updating tlmgr'
        : 'Checking the package repository status',
      async () => {
        try {
          await tlmgr.update({ self: true });
        } catch (error) {
          if (error instanceof TLVersionOutdated) {
            await updateRepository(profile.version);
            cache.update();
          } else {
            throw error;
          }
        }
      },
    );
    if (config.updateAllPackages) {
      await log.group(`Updating packages`, async () => {
        await tlmgr.update({ all: true, reinstallForciblyRemoved: true });
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

  await log.group('TeX Live version info', async () => {
    await tlmgr.version();
    log.info('Package version:');
    for await (const { name, version, revision } of tlmgr.list()) {
      log.info('  %s: %s', name, version ?? `rev${revision}`);
    }
  });

  cache.register();
  setOutput('version', config.version);
}

async function updateRepository(version: Version): Promise<void> {
  const tlmgr = Tlmgr.use();
  const tag = 'main';
  const historic = tlnet.historic(version, { master: true });
  log.info('Changing the %s repository to %s', tag, historic.href);
  await tlmgr.repository.remove(tag);
  await tlmgr.repository.add(historic, tag);
  await tlmgr.update({ self: true });
}

async function adjustTexmf(profile: Profile): Promise<void> {
  const tlmgr = Tlmgr.use();
  const keys = [
    'TEXMFLOCAL',
    ...Texmf.USER_TREES,
  ] as const satisfies readonly (keyof Texmf)[];
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
