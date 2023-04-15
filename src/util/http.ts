import { type IncomingHttpHeaders, STATUS_CODES } from 'node:http';

import { HttpClient, HttpClientError, HttpCodes } from '@actions/http-client';

let http: HttpClient | undefined;

export async function getJson<T>(url: string | Readonly<URL>): Promise<T> {
  http ??= new HttpClient();
  const { result, statusCode } = await http.getJson<T>(url.toString());
  if (statusCode !== HttpCodes.OK) {
    throw newClientError(statusCode, url);
  }
  /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    -- `result` should be non-null unless the status is 404. */
  return result!;
}

export async function getHeaders(
  url: string | Readonly<URL>,
): Promise<IncomingHttpHeaders> {
  http ??= new HttpClient();
  const { message } = await http.head(url.toString());
  const { headers, statusCode = Number.NaN } = message.destroy();
  if (statusCode !== HttpCodes.OK) {
    throw newClientError(statusCode, url);
  }
  return headers;
}

const REDIRECT_CODES: ReadonlySet<HttpCodes> = new Set([
  HttpCodes.MovedPermanently,
  HttpCodes.ResourceMoved,
  HttpCodes.SeeOther,
  HttpCodes.TemporaryRedirect,
  HttpCodes.PermanentRedirect,
]);

export async function getLocation(url: string | Readonly<URL>): Promise<URL> {
  const client = new HttpClient(undefined, undefined, {
    allowRedirects: false,
  });
  const { message } = await client.head(url.toString());
  const { headers, statusCode = Number.NaN } = message.destroy();
  if (!REDIRECT_CODES.has(statusCode as HttpCodes)) {
    throw newClientError(statusCode, url);
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return new URL(headers.location!);
}

function newClientError(
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
  Error.captureStackTrace(error, newClientError);
  return error;
}
