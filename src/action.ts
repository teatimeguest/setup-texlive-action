import * as crypto from 'crypto';
import * as os from 'os';

import * as core from '@actions/core';

import { Context } from './context';
import { InstallTL, Profile } from './install-tl';
import { contrib as tlcontrib, Manager, Version } from './texlive';
import * as util from './utility';

export async function run(): Promise<void> {
  try {
    if (core.getState('post') !== 'true') {
      await main();
      core.saveState('post', true);
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
  const { inputs, outputs, env } = await Context.get();
  const profile = new Profile(inputs.version, inputs.prefix);
  let cacheType = undefined;

  if (inputs.cache) {
    const keys = getCacheKeys(inputs.version, inputs.packages);
    cacheType = await core.group('Restoring cache', async () => {
      return await util.restoreCache(profile.TEXDIR, ...keys);
    });
    if (cacheType !== 'primary') {
      State.set({ key: keys[1][0], texdir: profile.TEXDIR });
    }
  }

  if (cacheType === undefined) {
    const installtl = await core.group('Acquiring install-tl', async () => {
      return await InstallTL.acquire(inputs.version);
    });
    await core.group('Installation profile', async () => {
      core.info(Profile.format(profile));
    });
    await core.group('Installing TeX Live', async () => {
      await installtl.run(profile);
    });
  }

  const tlmgr = new Manager(inputs.version, inputs.prefix);
  await tlmgr.path.add();

  if (cacheType !== undefined) {
    outputs.cacheHit();
    await core.group('Adjusting TEXMF', async () => {
      /* eslint-disable no-await-in-loop */
      for (const key of ['TEXMFHOME', 'TEXMFCONFIG', 'TEXMFVAR'] as const) {
        const value = env[`TEXLIVE_INSTALL_${key}`];
        if ((await tlmgr.conf.texmf(key)) !== value) {
          await tlmgr.conf.texmf(key, value);
        }
      } /* eslint-enable */
    });
  }

  if (inputs.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlcontrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType !== 'primary' && inputs.packages.size !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(...inputs.packages);
    });
  }
}

async function post(): Promise<void> {
  const { key, texdir } = State.get();
  if (key !== '' && texdir !== '') {
    await util.saveCache(texdir, key);
  }
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

interface State {
  readonly key: string;
  readonly texdir: string;
}

namespace State {
  export function get(): State {
    const key = core.getState('key');
    const texdir = core.getState('texdir');
    return { key, texdir };
  }

  export function set(state: State): void {
    core.saveState('key', state.key);
    core.saveState('texdir', state.texdir);
  }
}
