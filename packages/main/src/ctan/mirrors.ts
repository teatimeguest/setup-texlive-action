import { setTimeout } from 'node:timers/promises';

import * as log from '#/log';
import { HttpClient, HttpCodes, createClientError } from '#/util/http';

const CTAN_MASTER_URL = 'http://dante.ctan.org/tex-archive/';
const CTAN_MIRROR_URL = 'https://mirrors.ctan.org/';

const MAX_TRIES = 10;
const RETRY_DELAY = 500;

let resolvedMirrorLocation: Readonly<URL> | undefined;

export interface CtanMirrorOptions {
  /** @defaultValue `false` */
  readonly master?: boolean | undefined;
}

export async function resolve(options?: CtanMirrorOptions): Promise<URL> {
  if (options?.master ?? false) {
    return new URL(CTAN_MASTER_URL);
  }
  if (resolvedMirrorLocation !== undefined) {
    return new URL(resolvedMirrorLocation.href);
  }
  using http = new HttpClient(undefined, undefined, {
    allowRedirects: false,
    keepAlive: true,
  });
  for (let i = 0; i < MAX_TRIES; ++i) {
    try {
      const { message } = await http.head(CTAN_MIRROR_URL);
      const { headers, statusCode = Number.NaN } = message.destroy();
      if (!REDIRECT_CODES.has(statusCode as HttpCodes)) {
        throw createClientError(statusCode, CTAN_MIRROR_URL);
      }
      const mirror = new URL(headers.location!);
      log.debug(
        '[%d/%d] Resolved CTAN mirror: %s',
        i + 1,
        MAX_TRIES,
        mirror.href,
      );
      // These mirrors are quite unstable and
      // often cause problems with package checksum mismatches.
      if (/cicku/iv.test(mirror.hostname)) {
        await setTimeout(RETRY_DELAY);
        continue;
      }
      resolvedMirrorLocation = mirror;
      return new URL(mirror.href);
    } catch (cause) {
      throw new Error('Failed to resolve the CTAN mirror location', { cause });
    }
  }
  throw new Error('Failed to find a suitable CTAN mirror');
}

const REDIRECT_CODES: ReadonlySet<HttpCodes> = new Set([
  HttpCodes.MovedPermanently,
  HttpCodes.ResourceMoved,
  HttpCodes.SeeOther,
  HttpCodes.TemporaryRedirect,
  HttpCodes.PermanentRedirect,
]);

/* eslint no-await-in-loop: off */
