import { ctan } from '@setup-texlive-action/data/tlnet.json';
import { P, match } from 'ts-pattern';

import * as log from '#/log';
import {
  type InstallTL,
  InstallTLError,
  type Profile,
  ReleaseData,
  TlpdbError,
  acquire,
  tlnet,
} from '#/texlive';

export async function install(options: {
  readonly profile: Profile;
  readonly repository?: Readonly<URL> | undefined;
}): Promise<void> {
  const { latest, previous } = ReleaseData.use();
  const { version } = options.profile;

  let repository = options.repository;
  const fallbackToMaster = repository === undefined
    && version >= previous.version;

  let installTL: InstallTL | undefined;

  for (const master of fallbackToMaster ? [false, true] : [false]) {
    if (repository === undefined || master) {
      if (master && version === '2024') {
        repository = new URL(ctan.path, ctan.default);
      } else {
        repository = version >= latest.version
          ? await tlnet.ctan({ master })
          : tlnet.historic(version, { master });
      }
    }
    try {
      installTL ??= await acquire({ repository, version });
    } catch (error) {
      if (
        !master
        && fallbackToMaster
        && error instanceof InstallTLError
        && match(error.code)
          .with(InstallTLError.Code.FAILED_TO_DOWNLOAD, () => true)
          .with(InstallTLError.Code.UNEXPECTED_VERSION, () => true)
          .otherwise(() => false)
      ) {
        log.info({ error });
        continue;
      }
      throw error;
    }
    log.info('Using repository: %s', repository);
    try {
      await installTL.run({
        profile: options.profile,
        repository: options.repository ?? repository,
      });
      return;
    } catch (error) {
      if (
        !master
        && fallbackToMaster
        && match(error)
          .with(
            P.instanceOf(TlpdbError),
            ({ code }) => code === TlpdbError.Code.FAILED_TO_INITIALIZE,
          )
          .with(
            P.instanceOf(InstallTLError),
            ({ code }) =>
              code === InstallTLError.Code.INCOMPATIBLE_REPOSITORY_VERSION,
          )
          .otherwise(() => false)
      ) {
        log.info({ error });
        continue;
      }
      throw error;
    }
  }
}

/* eslint no-await-in-loop: off */
