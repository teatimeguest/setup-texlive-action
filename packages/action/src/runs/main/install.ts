import data from '@setup-texlive-action/data/tlnet.json' with { type: 'json' };
import * as log from '@setup-texlive-action/logger';
import {
  type InstallTL,
  InstallTLError,
  type Profile,
  ReleaseData,
  TlpdbError,
  type Version,
  acquire,
  tlnet,
} from '@setup-texlive-action/texlive';
import { P, match } from 'ts-pattern';

export interface InstallOptions {
  profile: Profile;
  repository?: Readonly<URL> | undefined;
}

export async function install(
  options: Readonly<InstallOptions>,
): Promise<void> {
  await new Installer(options).run();
}

class Installer {
  private readonly maxRetries: 0 | 1 = 0;
  private try: number = 1;
  private installTL: InstallTL | undefined;

  constructor(private options: Readonly<InstallOptions>) {
    if (
      this.options.repository === undefined
      && this.version >= ReleaseData.use().previous.version
    ) {
      this.maxRetries = 1;
    }
  }

  async run(): Promise<void> {
    for (; this.try <= this.maxRetries + 1; ++this.try) {
      try {
        await this.tryWith(await this.pickRepository());
        return;
      } catch (error) {
        if (
          this.try <= this.maxRetries
          && match(error)
            .with(
              P.instanceOf(InstallTLError),
              {
                code: P.union(
                  InstallTLError.Code.FAILED_TO_DOWNLOAD,
                  InstallTLError.Code.UNEXPECTED_VERSION,
                  InstallTLError.Code.INCOMPATIBLE_REPOSITORY_VERSION,
                ),
              },
              () => true,
            )
            .with(
              P.instanceOf(TlpdbError),
              { code: TlpdbError.Code.FAILED_TO_INITIALIZE },
              () => true,
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

  private async tryWith(repository: Readonly<URL>): Promise<void> {
    if (this.try > 1) {
      log.info('Switched to repository: %s', repository);
    } else {
      log.info('Using repository: %s', repository);
    }
    this.installTL ??= await acquire({ repository, version: this.version });
    await this.installTL.run({
      profile: this.options.profile,
      repository,
    });
  }

  private async pickRepository(): Promise<URL> {
    if (this.try === 1 && this.options.repository !== undefined) {
      return new URL(this.options.repository);
    }
    if (this.version < ReleaseData.use().latest.version) {
      switch (this.try) {
        case 1:
          return tlnet.historic(this.version);
        case 2:
          return new URL(
            `https://mirrors.tuna.tsinghua.edu.cn/tex-historic-archive/systems/texlive/${this.version}/tlnet-final/`,
          );
      }
    } else {
      switch (this.try) {
        case 1:
          return await tlnet.ctan({ master: false });
        case 2:
          return new URL(data.ctan.path, data.ctan.default);
      }
    }
    throw new Error('Failed to find a suitable repository');
  }

  get version(): Version {
    return this.options.profile.version;
  }
}

/* eslint no-await-in-loop: off */
