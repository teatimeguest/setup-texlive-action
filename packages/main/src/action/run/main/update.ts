import { getProxyUrl } from '@actions/http-client';

import { CacheService } from '#/action/cache';
import * as log from '#/log';
import { Texmf } from '#/tex/texmf';
import {
  type Profile,
  ReleaseData,
  Tlmgr,
  TlmgrError,
  TlpdbError,
  type Version,
  tlnet,
} from '#/texlive';

export async function updateTlmgr(version: Version): Promise<void> {
  const tlmgr = Tlmgr.use();
  const { isOnePrevious } = ReleaseData.use();
  try {
    await tlmgr.update({ self: true });
    return;
  } catch (error) {
    const tlcontrib = 'tlcontrib';
    if (
      isOnePrevious(version)
      && error instanceof TlmgrError
      && (
        error.code === TlmgrError.Code.TL_VERSION_OUTDATED
        || (
          error.code === TlmgrError.Code.TL_VERSION_NOT_SUPPORTED
          && 'repository' in error
          && error.repository.includes(tlcontrib)
        )
      )
    ) {
      log.info({ error });
      try {
        log.info('Removing `%s`', tlcontrib);
        await tlmgr.repository.remove(tlcontrib);
        await tlmgr.update({ self: true });
      } catch (error) { // eslint-disable-line @typescript-eslint/no-shadow
        log.info(`${error}`);
        log.debug({ error });
      }
    }
  }
  try {
    await setupHistoric(version);
  } catch (error) {
    if (
      error instanceof TlpdbError
      && error.code === TlpdbError.Code.FAILED_TO_INITIALIZE
    ) {
      log.info({ error });
      await setupHistoric(version, { master: true });
    } else {
      throw error;
    }
  }
  CacheService.use().update();
}

export async function setupHistoric(
  version: Version,
  options?: { readonly master?: boolean },
): Promise<void> {
  const tlmgr = Tlmgr.use();
  const tag = 'main';
  const historic = tlnet.historic(version, options);
  log.info('Changing the %s repository to %s', tag, historic.href);
  if (historic.protocol === 'ftp:' && getProxyUrl(historic.href) !== '') {
    throw new Error(
      'The use of ftp repositories under proxy is currently not supported',
    );
  }
  await tlmgr.repository.remove(tag);
  await tlmgr.repository.add(historic, tag);
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
