import { ctan } from '@setup-texlive-action/data/tlnet.json';
import * as log from '@setup-texlive-action/logger';
import {
  type InstallTL,
  InstallTLError,
  type Profile,
  ReleaseData,
  TlpdbError,
  acquire,
  tlnet,
} from '@setup-texlive-action/texlive';
import { P, match } from 'ts-pattern';

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
      if (version >= latest.version) {
        repository = master
          ? new URL(ctan.path, ctan.default)
          : await tlnet.ctan({ master });
      } else {
        repository = master
          // hotfix (#304)
          ? new URL(
            `https://mirrors.tuna.tsinghua.edu.cn/tex-historic-archive/systems/texlive/${version}/tlnet-final/`,
          )
          : tlnet.historic(version);
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
