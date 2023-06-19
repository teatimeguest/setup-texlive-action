import { Memoize } from 'typescript-memoize';

import * as ctan from '#/ctan';
import * as log from '#/log';
import * as tlnet from '#/texlive/tlnet';
import { Version } from '#/texlive/version/types';
import { http } from '#/util';

import { config } from '##/package.json';

const FALLBACK_VERSION = config.texlive.latest.version as Version;

// eslint-disable-next-line @typescript-eslint/naming-convention
const { Instant, Now, PlainDateTime, ZonedDateTime } = Temporal;
type ZonedDateTime = Temporal.ZonedDateTime;

export default abstract class Latest {
  @Memoize()
  static async getVersion(this: void): Promise<Version> {
    const now = Now.instant();
    /** @see {@link https://en.wikipedia.org/wiki/UTC%2B14:00} */
    const tzEarliest = '+14:00';
    const releaseDate = PlainDateTime
      .from(config.texlive.next.releaseDate)
      .toZonedDateTime(tzEarliest)
      .toInstant();
    if (Instant.compare(now, releaseDate) >= 0) {
      return await Latest.checkVersion();
    } else {
      return FALLBACK_VERSION;
    }
  }

  @Memoize()
  static async checkVersion(this: void): Promise<Version> {
    log.info('Checking for the latest version of TeX Live');
    try {
      const data = await ctan.api.pkg('texlive');
      const version = Version.parse(data.version?.number ?? '');
      log.info(`Latest version: ${version}`);
      return version;
    } catch (cause) {
      log.info('Failed to check for the latest version', { cause });
      log.info(
        `Instead ${FALLBACK_VERSION} will be used as the latest version`,
      );
    }
    return FALLBACK_VERSION;
  }

  static async isLatest(this: void, version: Version): Promise<boolean> {
    return version === await Latest.getVersion();
  }

  /**
   * @privateRemarks
   *
   * There appears to be no formal way to check the release date (and time) of
   * TeX Live, but the modified timestamp of the `TEXLIVE_YYYY` file seems to be
   * a good approximation.
   */
  @Memoize()
  static async getReleaseDate(this: void): Promise<ZonedDateTime> {
    const latest = await Latest.getVersion();
    if (latest === config.texlive.latest.version) {
      return ZonedDateTime.from(config.texlive.latest.releaseDate);
    }
    const ctanMaster = await tlnet.ctan({ master: true });
    const url = new URL(`TEXLIVE_${latest}`, ctanMaster);
    const headers = await http.getHeaders(url);
    const timestamp = headers['last-modified'] ?? '';
    const epoch = Date.parse(timestamp);
    if (Number.isNaN(epoch)) {
      throw new TypeError(`Invalid timestamp: ${timestamp}`);
    }
    return new Date(epoch).toTemporalInstant().toZonedDateTimeISO('UTC');
  }
}
