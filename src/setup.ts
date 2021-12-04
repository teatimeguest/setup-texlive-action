import * as crypto from 'crypto';
import * as os from 'os';

import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as context from '#/context';
import * as tl from '#/texlive';

export async function run(): Promise<void> {
  if (context.getPost()) {
    await saveCache();
  } else {
    await setup();
    context.setPost();
  }
}

function getCacheKeys(
  version: tl.Version,
  packages: ReadonlyArray<string>,
): [string, Array<string>] {
  const digest = (s: string): string => {
    return crypto.createHash('sha256').update(s).digest('hex');
  };
  const baseKey = `setup-texlive-${os.platform()}-${os.arch()}-${version}-`;
  const primaryKey = `${baseKey}${digest(JSON.stringify(packages))}`;
  return [primaryKey, [baseKey]];
}

async function setup(): Promise<void> {
  const inputs = context.getInputs();
  const tlmgr = new tl.Manager(inputs.version, inputs.prefix);
  const texdir = tlmgr.conf.texmf().texdir;
  const [primaryKey, restoreKeys] = getCacheKeys(
    inputs.version,
    inputs.packages,
  );

  let cacheKey: string | undefined = undefined;

  if (inputs.cache) {
    try {
      cacheKey = await cache.restoreCache([texdir], primaryKey, restoreKeys);
    } catch (error) {
      core.info(`Failed to restore cache: ${error}`);
      if (error instanceof Error && error.stack !== undefined) {
        core.debug(error.stack);
      }
    }
  }

  if (Boolean(cacheKey)) {
    core.info('Cache restored');
    context.setCacheHit();
    await tlmgr.path.add();
    if (cacheKey === primaryKey) {
      return;
    }
  } else {
    await tl.install(inputs.version, inputs.prefix);
  }

  if (inputs.tlcontrib) {
    await core.group('Setting up TLContrib', async () => {
      await tlmgr.repository.add(tl.tlcontrib().href, 'tlcontrib');
      await tlmgr.pinning.add('tlcontrib', '*');
    });
  }

  if (inputs.packages.length !== 0) {
    await core.group('Installing packages', async () => {
      await tlmgr.install(inputs.packages);
    });
  }

  if (inputs.cache) {
    context.setKey(primaryKey);
  }
}

async function saveCache(): Promise<void> {
  const { version, prefix } = context.getInputs();
  const tlmgr = new tl.Manager(version, prefix);
  const primaryKey = context.getKey();

  if (primaryKey === undefined) {
    core.info('Nothing to do');
    return;
  }

  try {
    await cache.saveCache([tlmgr.conf.texmf().texdir], primaryKey);
    core.info(`Cache saved`);
  } catch (error) {
    core.warning(`${error}`);
    if (error instanceof Error && error.stack !== undefined) {
      core.debug(error.stack);
    }
  }
}
