import * as crypto from 'crypto';
import * as os from 'os';

import * as core from '@actions/core';

import { Env, Inputs, Outputs, State } from '#/context';
import { InstallTL, Profile } from '#/install-tl';
import * as log from '#/log';
import { contrib as tlcontrib, Manager, Version } from '#/texlive';
import * as util from '#/utility';

export async function run(): Promise<void> {
  try {
    const state = State.load();
    if (state === null) {
      await main();
    } else if (state.filled()) {
      await util.saveCache(state.texdir, state.key);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.stack ?? error);
    } else {
      core.setFailed(`${error}`);
    }
  }
}

async function main(): Promise<void> {
  const inputs = new Inputs();
  const outputs = new Outputs();
  const env = Env.get(inputs.version);
  const state = new State();

  const profile = new Profile(inputs.version, inputs.prefix);
  const packages = await inputs.packages;
  let cacheType = undefined;

  if (inputs.cache) {
    const keys = getCacheKeys(inputs.version, packages);
    cacheType = await core.group('Restoring cache', async () => {
      return await util.restoreCache(profile.TEXDIR, ...keys);
    });
    if (cacheType !== 'primary') {
      state.key = keys[0];
      state.texdir = profile.TEXDIR;
    }
  }

  if (cacheType === undefined) {
    const installtl = await core.group('Acquiring install-tl', async () => {
      return (
        InstallTL.restore(inputs.version) ??
        (await InstallTL.download(inputs.version))
      );
    });
    await core.group('Installation profile', async () => {
      log.info(profile.toString());
    });
    await core.group('Installing TeX Live', async () => {
      await installtl.run(profile);
    });
  }

  const tlmgr = new Manager(inputs.version, inputs.prefix);
  await tlmgr.path.add();

  if (cacheType !== undefined) {
    await core.group('Updating tlmgr', async () => {
      await tlmgr.update(undefined, { self: true });
    });
    await core.group('Adjusting TEXMF', async () => {
      for (const key of ['TEXMFHOME', 'TEXMFCONFIG', 'TEXMFVAR'] as const) {
        const value = env[`TEXLIVE_INSTALL_${key}`];
        // eslint-disable-next-line no-await-in-loop
        if ((await tlmgr.conf.texmf(key)) !== value) {
          // eslint-disable-next-line no-await-in-loop
          await tlmgr.conf.texmf(key, value);
        }
      }
    });
    outputs['cache-hit'] = true;
  }

  if (inputs.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tlcontrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (cacheType !== 'primary' && packages.size !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(...packages);
    });
  }

  state.save();
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
