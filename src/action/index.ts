import { createHash, randomUUID } from 'node:crypto';
import { arch, platform } from 'node:os';
import { isNativeError } from 'node:util/types';

import { setFailed } from '@actions/core';
import { keys } from 'ts-transformer-keys';

import { Inputs } from '#/action/inputs';
import { Outputs } from '#/action/outputs';
import { State } from '#/action/state';
import * as log from '#/log';
import { Profile, Tlmgr, installTL, tlnet } from '#/texlive';
import type { UserTrees } from '#/texmf';
import { restoreCache, saveCache } from '#/utility';

export async function run(): Promise<void> {
  try {
    const state = new State();
    if (!state.post) {
      await main(state);
    } else {
      await post(state);
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

export async function main(state: State = new State()): Promise<void> {
  const inputs = await Inputs.load();
  const outputs = new Outputs();
  outputs.version = inputs.version;

  const profile = new Profile(inputs);
  let installPackages = inputs.packages.size > 0;

  if (inputs.cache) {
    await log.group('Restoring cache', async () => {
      const [unique, primary, secondary] = getCacheKeys(inputs);
      state.key = inputs.forceUpdateCache ? unique : primary;
      const restored = await restoreCache(
        profile.TEXDIR,
        unique,
        [primary, secondary],
      );
      if (restored?.startsWith(state.key) === true) {
        state.key = restored;
      } else {
        state.texdir = profile.TEXDIR;
        log.info(
          'After the job completes, TEXDIR will be saved to cache with key:',
        );
        log.info('  ' + state.key);
      }
      outputs.cacheHit = restored !== undefined;
      installPackages &&= restored?.startsWith(primary) !== true;
    });
  }

  if (!outputs.cacheHit) {
    await log.group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await log.group('Installing TeX Live', async () => {
      await installTL(profile);
    });
  }

  const tlmgr = new Tlmgr(profile);
  await tlmgr.path.add();

  if (outputs.cacheHit) {
    if (inputs.version.isLatest()) {
      const target = inputs.updateAllPackages ? 'all packages' : 'tlmgr';
      await log.group(`Updating ${target}`, async () => {
        await tlmgr.update([], { self: true });
        if (inputs.updateAllPackages) {
          await tlmgr.update([], { all: true, reinstallForciblyRemoved: true });
        }
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
      await tlmgr.repository.add(tlnet.CONTRIB.href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (installPackages) {
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

  state.save();
  outputs.emit();
}

export async function post({ key, texdir }: Readonly<State>): Promise<void> {
  if (key !== undefined) {
    if (texdir !== undefined) {
      await saveCache(texdir, key);
    } else {
      log.info(
        `Cache hit occurred on the primary key ${key}, not saving cache`,
      );
    }
  }
}

function getCacheKeys({ version, packages }: Inputs): [string, string, string] {
  const secondary = `setup-texlive-${platform()}-${arch()}-${version}-`;
  const primary = secondary
    + createHash('sha256').update(JSON.stringify([...packages])).digest('hex');
  const unique = `${primary}-${randomUUID().replaceAll('-', '')}`;
  return [unique, primary, secondary];
}
