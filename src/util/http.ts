import { type IncomingHttpHeaders, STATUS_CODES } from 'node:http';

import {
  HttpClient as ActionsHttpClient,
  HttpClientError,
  HttpCodes,
} from '@actions/http-client';

export class HttpClient extends ActionsHttpClient implements Disposable {
  [Symbol.dispose](): void {
    this.dispose();
  }
}

export async function getJson<T>(url: string | Readonly<URL>): Promise<T> {
  using http = new HttpClient();
  const { result, statusCode } = await http.getJson<T>(url.toString());
  if (statusCode !== HttpCodes.OK) {
    throw createClientError(statusCode, url);
  }
  // `result` should be non-null unless the status is 404.
  return result!;
}

export async function getHeaders(
  url: string | Readonly<URL>,
): Promise<IncomingHttpHeaders> {
  using http = new HttpClient();
  const { message } = await http.head(url.toString());
  const { headers, statusCode = Number.NaN } = message.destroy();
  if (statusCode !== HttpCodes.OK) {
    throw createClientError(statusCode, url);
  }
  return headers;
}

export function createClientError(
  statusCode: number,
  url: string | Readonly<URL>,
): HttpClientError {
  let msg = `${url} returned ${statusCode}`;
  if (statusCode in STATUS_CODES) {
    msg += `: ${STATUS_CODES[statusCode]}`;
  }
  // https://nodejs.org/api/errors.html#errorcapturestacktracetargetobject-constructoropt
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new HttpClientError(msg, statusCode);
  Error.stackTraceLimit = stackTraceLimit;
  Error.captureStackTrace(error, createClientError);
  return error;
}

export { HttpCodes };

/* eslint @typescript-eslint/no-unsafe-enum-comparison: off */
