import type { ResponseData } from 'http-headers';

declare var http: ResponseData;

export const { version, statusCode, statusMessage, headers }: ResponseData;
export default http;
