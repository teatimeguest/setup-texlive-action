import parseHttp, { type ResponseData } from 'http-headers';
import nock, { type ReplyHeaders } from 'nock';

import * as ctan from '#/ctan';

beforeAll(async () => {
  const { headers, statusCode } = parseHttp(
    await fixtures('mirrors.ctan.org.http'),
  ) as ResponseData;

  nock('https://mirrors.ctan.org')
    .head('/')
    .reply(statusCode, '', headers as ReplyHeaders);
});

afterAll(nock.restore);

vi.unmock('@actions/http-client');
vi.unmock('#/ctan/mirrors');

describe('mirrors.resolve', () => {
  const mirror = new URL('https://ctan.math.washington.edu/tex-archive/');

  it('resolves location', async () => {
    await expect(ctan.mirrors.resolve()).resolves.toStrictEqual(mirror);
    expect(nock.isDone()).toBeTrue();
  });

  it('does not send a request twice', async () => {
    await expect(ctan.mirrors.resolve()).resolves.toStrictEqual(mirror);
  });
});
