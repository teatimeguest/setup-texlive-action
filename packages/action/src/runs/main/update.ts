import { getProxyUrl } from '@actions/http-client';
import * as log from '@setup-texlive-action/logger';
import {
  type Profile,
  ReleaseData,
  Texmf,
  Tlmgr,
  TlmgrError,
  TlpdbError,
  type Version,
  tlnet,
} from '@setup-texlive-action/texlive';

import { CacheService } from '#action/cache';

export interface UpdateOptions {
  readonly version: Version;
  readonly repository?: Readonly<URL> | undefined;
}

export async function updateTlmgr(options: UpdateOptions): Promise<void> {
  try {
    await updateRepositories(options);
  } catch (error) {
    if (
      error instanceof TlmgrError
      && error.code === TlmgrError.Code.TL_VERSION_OUTDATED
      && options.repository === undefined
    ) {
      log.info({ error });
      await moveToHistoric(options.version);
    } else {
      throw error;
    }
  }
}

async function updateRepositories(options: UpdateOptions): Promise<void> {
  const tlmgr = Tlmgr.use();
  const { latest, previous } = ReleaseData.use();
  const version = options.version;
  let repository = options.repository;
  if (version >= previous.version) {
    for await (const { path, tag } of tlmgr.repository.list()) {
      if (
        tag === 'main'
        && path.includes('tlpretest')
        && repository === undefined
        && version === latest.version
      ) {
        repository = await tlnet.ctan();
      } else if (
        (tag === 'tlcontrib' || path.includes('tlcontrib'))
        && version < latest.version
      ) {
        log.info(`Removing %s`, tag ?? path);
        await tlmgr.repository.remove(tag ?? path);
      }
    }
  }
  if (repository !== undefined) {
    await changeRepository('main', repository);
  } else {
    await tlmgr.update({ self: true });
  }
}

async function moveToHistoric(version: Version): Promise<void> {
  const cache = CacheService.use();
  const tag = 'main';
  try {
    await changeRepository(tag, tlnet.historic(version));
  } catch (error) {
    if (
      error instanceof TlpdbError
      && error.code === TlpdbError.Code.FAILED_TO_INITIALIZE
    ) {
      log.info({ error });
      await changeRepository(tag, tlnet.historic(version, { master: true }));
    } else {
      throw error;
    }
  }
  cache.update();
}

async function changeRepository(
  tag: string,
  url: Readonly<URL>,
): Promise<void> {
  const tlmgr = Tlmgr.use();
  log.info('Changing the repository `%s` to %s', tag, url.href);
  if (url.protocol === 'ftp:' && getProxyUrl(url.href) !== '') {
    throw new Error(
      'The use of ftp repositories under proxy is currently not supported',
    );
  }
  await tlmgr.repository.remove(tag);
  await tlmgr.repository.add(url, tag);
  await tlmgr.update({ self: true });
}

export async function adjustTexmf(profile: Profile): Promise<void> {
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
        await tlmgr.conf.texmf(key, value);
      }
    });
  }
}

/* eslint no-await-in-loop: off */
