import { createHash } from 'node:crypto';
import { arch, platform } from 'node:os';
import { isNativeError } from 'node:util/types';

import { group, setFailed } from '@actions/core';
import { keys } from 'ts-transformer-keys';

import { Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import * as log from '#/log';
import { type Texmf, Tlmgr, Version, tlnet } from '#/texlive';
import { CacheType, restoreCache, saveCache } from '#/utility';

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

export async function main(
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  state: State,
  inputs: Inputs = new Inputs(),
  outputs: Outputs = new Outputs(),
): Promise<void> {
  const packages = await inputs.packages;
  let cacheType = undefined as CacheType | undefined;

  if (inputs.cache) {
    const [primary, secondary] = getCacheKeys(inputs.version, packages);
    state.key = primary;
    await group('Restoring cache', async () => {
      cacheType = await restoreCache(inputs.texmf.TEXDIR, primary, secondary);
      if (cacheType !== 'primary') {
        state.texdir = inputs.texmf.TEXDIR;
        log.info(
          'After the job completes, '
            + `${state.texdir} will be cached with key: ${state.key}`,
        );
      }
    });
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
    outputs.cacheHit = true;
  }

  if (inputs.tlcontrib) {
    await group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlnet.contrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType !== 'primary' && packages.size > 0) {
    await group('Installing packages', async () => {
      await tlmgr.install(...packages);
    });
  }

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
  } else {
    log.info('Nothing to do');
  }
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
