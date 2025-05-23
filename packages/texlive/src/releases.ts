import versions from '@setup-texlive-action/data/texlive-versions.json' with {
  type: 'json',
};
import * as log from '@setup-texlive-action/logger';
import deline from 'deline';
import { createContext } from 'unctx';

import * as ctan from '#texlive/ctan';
import * as tlnet from '#texlive/tlnet';
import { Version } from '#texlive/version';

const { Instant, Now, PlainDateTime, ZonedDateTime } = Temporal;
type ZonedDateTime = Temporal.ZonedDateTime;

export interface Release {
  readonly version: Version;
  readonly releaseDate?: ZonedDateTime | undefined;
}

export interface ReleaseData {
  readonly newVersionReleased: () => boolean;
  readonly previous: Release;
  readonly latest: Release;
  readonly next: Release;
}

export namespace ReleaseData {
  const ctx = createContext<ReleaseData>();
  export const { use } = ctx;

  export async function setup(): Promise<ReleaseData> {
    const latest = new Latest();
    if (Latest.needToCheck()) {
      await latest.checkVersion();
    }
    function newVersionReleased(): boolean {
      return versions.current.version < latest.version;
    }
    const latestVersionNumber = Number.parseInt(latest.version, 10);
    const releases = {
      newVersionReleased,
      previous: { version: `${latestVersionNumber - 1}` as Version },
      latest,
      next: { version: `${latestVersionNumber + 1}` as Version },
    };
    ctx.set(releases);
    return releases;
  }
}

/** @internal */
export class Latest implements Release {
  releaseDate: ZonedDateTime | undefined;
  #version: Version = versions.current.version as Version;

  get version(): Version {
    return this.#version;
  }

  private set version(latest: Version) {
    if (this.#version < latest) {
      this.#version = latest;
      this.releaseDate = undefined;
      log.notify(
        deline`
          TeX Live %d has been released.
          The action may not work properly for a few days after release.
        `,
        latest,
      );
    }
    log.info('Latest version: %s', this.version);
  }

  async checkVersion(): Promise<Version> {
    log.info('Checking for latest version of TeX Live');
    try {
      const { version } = await ctan.api.pkg('texlive');
      this.version = Version.parse(version?.number ?? '');
    } catch (error) {
      log.info({ error }, 'Failed to check for latest version');
      log.info('Use `%s` as latest version', this.version);
    }
    return this.version;
  }

  /**
   * @privateRemarks
   *
   * There appears to be no formal way to check the release date (and time) of
   * TeX Live, but the modified timestamp of the `TEXLIVE_YYYY` file seems to be
   * a good approximation.
   */
  async checkReleaseDate(): Promise<ZonedDateTime> {
    if (this.releaseDate !== undefined) {
      return this.releaseDate;
    }
    if (this.version === versions.current.version) {
      return this.releaseDate = ZonedDateTime.from(
        versions.current.releaseDate,
      );
    }
    const ctanMaster = await tlnet.ctan({ master: true });
    const headers = await tlnet.checkVersionFile(ctanMaster, this.version);
    if (headers === undefined) {
      const error = new Error('`TEXLIVE_YYYY` file not found');
      error['repository'] = ctanMaster;
      error['version'] = this.version;
      throw error;
    }
    const timestamp = headers['last-modified'] ?? '';
    const epoch = Date.parse(timestamp);
    if (Number.isNaN(epoch)) {
      const error = new TypeError(`Invalid timestamp: ${timestamp}`);
      error['repository'] = ctanMaster;
      error['version'] = this.version;
      throw error;
    }
    return this.releaseDate = new Date(epoch)
      .toTemporalInstant()
      .toZonedDateTimeISO('UTC');
  }

  static needToCheck(): boolean {
    const now = Now.instant();
    /** @see {@link https://en.wikipedia.org/wiki/UTC%2B14:00} */
    const tzEarliest = '+14:00';
    const nextReleaseDate = PlainDateTime
      .from(versions.next.releaseDate)
      .toZonedDateTime(tzEarliest)
      .toInstant();
    return Instant.compare(now, nextReleaseDate) >= 0;
  }
}
