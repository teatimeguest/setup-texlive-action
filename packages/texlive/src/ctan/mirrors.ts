import { setTimeout } from 'node:timers/promises';

import data from '@setup-texlive-action/data/tlnet.json' with { type: 'json' };
import * as log from '@setup-texlive-action/logger';
import {
  HttpClient,
  HttpCodes,
  createClientError,
} from '@setup-texlive-action/utils/http';

const MAX_TRIES = 10;
const RETRY_DELAY = 500;

let resolvedMirrorLocation: Readonly<URL> | undefined;

export interface CtanMirrorOptions {
  /** @defaultValue `false` */
  readonly master?: boolean | undefined;
}

export async function resolve(options?: CtanMirrorOptions): Promise<URL> {
  if (options?.master ?? false) {
    return new URL(data.ctan.master);
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
      const { message } = await http.head(data.ctan.mirrors);
      const { headers, statusCode = Number.NaN } = message.destroy();
      if (!REDIRECT_CODES.has(statusCode as HttpCodes)) {
        throw createClientError(statusCode, data.ctan.mirrors);
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
