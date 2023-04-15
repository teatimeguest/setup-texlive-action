import { platform } from 'node:os';

import { cache as Cache } from 'decorator-cache-getter';

import * as ctan from '#/ctan';
import * as log from '#/log';

export class Version {
  constructor(private readonly spec: string) {
    if (/^199[6-9]|200[0-7]$/u.test(spec)) {
      throw new RangeError('Versions prior to 2008 are not supported');
    } else if (/^20\d\d$/u.test(spec) && spec <= Version.LATEST) {
      if (platform() === 'darwin' && spec < '2013') {
        throw new RangeError(
          'Versions prior to 2013 does not work on 64-bit macOS',
        );
      }
    } else if (spec !== 'latest') {
      throw new TypeError(`'${spec}' is not a valid version spec`);
    }
  }

  @Cache
  get number(): number {
    return Number.parseInt(this.toString());
  }

  isLatest(): boolean {
    return this.spec === 'latest' || this.toString() === Version.LATEST;
  }

  toString(): string {
    return this.spec === 'latest' ? Version.LATEST : this.spec;
  }

  toJSON(): string {
    return this.toString();
  }

  [Symbol.toPrimitive](hint: string): number | string {
    return hint === 'number' ? this.number : this.toString();
  }

  private static latest: string = '2023';

  static get LATEST(): string {
    return this.latest;
  }

  static async checkLatest(this: void): Promise<string> {
    const pkg = await ctan.api.pkg('texlive');
    const latest = pkg.version?.number ?? '';
    if (!/^20\d\d$/u.test(latest)) {
      throw new TypeError(`Invalid response: ${JSON.stringify(pkg)}`);
    }
    return Version.latest = latest;
  }

  static async resolve(this: void, spec: string): Promise<Version> {
    // TeX Live 2023 is scheduled for release on 19 March.
    // See: https://www.tug.org/texlive/
    //
    // if (Date.now() > Date.UTC(Number.parseInt(Version.LATEST) + 1, 4, 1)) {
    if (Date.now() > Date.UTC(Number.parseInt(Version.LATEST) + 1, 3, 17)) {
      try {
        log.info('Checking for the latest version of TeX Live');
        log.info(`Latest version: ${await Version.checkLatest()}`);
      } catch (cause) {
        log.info('Failed to check for the latest version', { cause });
        log.info(
          `Instead ${Version.LATEST} will be used as the latest version`,
        );
      }
    }
    return new Version(spec);
  }
}
