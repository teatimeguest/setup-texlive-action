import * as log from '#/log';
import {
  InstallTLError,
  Profile,
  ReleaseData,
  TlpdbError,
  installTL,
  tlnet,
} from '#/texlive';

export async function install(profile: Profile): Promise<void> {
  const { isLatest, isOnePrevious } = ReleaseData.use();
  for (const master of [false, true]) {
    const repository = isLatest(profile.version)
      ? await tlnet.ctan({ master })
      : tlnet.historic(profile.version, { master });
    log.info('Main repository: %s', repository);
    try {
      await installTL({ profile, repository });
      return;
    } catch (error) {
      const recoverable: (InstallTLError.Code | TlpdbError.Code)[] = [
        InstallTLError.Code.FAILED_TO_DOWNLOAD,
        InstallTLError.Code.INCOMPATIBLE_REPOSITORY_VERSION,
        InstallTLError.Code.UNEXPECTED_VERSION,
        TlpdbError.Code.FAILED_TO_INITIALIZE,
      ];
      if (
        !master
        && (isLatest(profile.version) || isOnePrevious(profile.version))
        && (error instanceof TlpdbError
          || error instanceof InstallTLError)
        && recoverable.includes(error.code!)
      ) {
        log.info({ error });
      } else {
        throw error;
      }
    }
  }
}

/* eslint no-await-in-loop: off */
