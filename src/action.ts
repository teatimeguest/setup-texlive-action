import { createHash } from 'crypto';
import { arch, platform } from 'os';
import { isNativeError } from 'util/types';

import { group, setFailed } from '@actions/core';
import { keys } from 'ts-transformer-keys';

import { Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import * as log from '#/log';
import { type Texmf, Tlmgr, Version, tlnet } from '#/texlive';
import { restoreCache, saveCache } from '#/utility';

export async function run(): Promise<void> {
  try {
    const state = State.load();
    if (state === null) {
      await main();
    } else {
      if (state.filled()) {
        await saveCache(state.texdir, state.key);
      } else {
        log.info('Nothing to do');
      }
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

async function main(): Promise<void> {
  const inputs = new Inputs();
  const outputs = new Outputs();
  const state = new State();

  const packages = await inputs.packages;
  let cacheType = undefined;

  if (inputs.cache) {
    const [primary, secondary] = getCacheKeys(inputs.version, packages);
    cacheType = await group('Restoring cache', async () => {
      return await restoreCache(inputs.texmf.TEXDIR, primary, secondary);
    });
    if (cacheType !== 'primary') {
      state.key = primary;
      state.texdir = inputs.texmf.TEXDIR;
    }
  }

  if (cacheType === undefined) {
    const installtl = await group('Acquiring install-tl', async () => {
      return await InstallTL.acquire(inputs.version);
    });
    const profile = new Profile(inputs.version, inputs.texmf);
    await group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await group('Installing TeX Live', async () => {
      await installtl.run(profile);
    });
  }

  const tlmgr = new Tlmgr(inputs.version, inputs.texmf.TEXDIR);
  await tlmgr.path.add();

  if (cacheType !== undefined) {
    if (Version.isLatest(inputs.version)) {
      await group('Updating tlmgr', async () => {
        await tlmgr.update(undefined, { self: true });
      });
      if (inputs.updateAllPackages) {
        await group('Updating packages', async () => {
          await tlmgr.update(undefined, {
            all: true,
            reinstallForciblyRemoved: true,
          });
        });
      }
    }
    await group('Adjusting TEXMF', async () => {
      for (const key of keys<Texmf.UserTrees>()) {
        const value = inputs.texmf[key];
        /* eslint-disable no-await-in-loop */
        if ((await tlmgr.conf.texmf(key)) !== value) {
          await tlmgr.conf.texmf(key, value);
        }
        /* eslint-enable */
      }
    });
    outputs['cache-hit'] = true;
  }

  if (inputs.tlcontrib) {
    await group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlnet.contrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType !== 'primary' && packages.size !== 0) {
    await group('Installing packages', async () => {
      await tlmgr.install(...packages);
    });
  }

  state.save();
  outputs.emit();
}

function getCacheKeys(
  version: Version,
  packages: ReadonlySet<string>,
): [string, [string]] {
  const baseKey = `setup-texlive-${platform()}-${arch()}-${version}-`;
  const primaryKey = `${baseKey}${
    createHash('sha256').update(JSON.stringify([...packages])).digest('hex')
  }`;
  return [primaryKey, [baseKey]];
}
