import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import * as core from '@actions/core';
import json from '@setup-texlive-action/fixtures/ctan-api-pkg-texlive.json';
import nock from 'nock';

import { Latest, ReleaseData } from '#/texlive/releases';

vi.unmock('@actions/http-client');
vi.unmock('#/texlive/releases');

let doMock: () => nock.Scope;

beforeAll(async () => {
  json.version.number = LATEST_VERSION;
  doMock = () => {
    return nock('https://ctan.org')
      .get('/json/2.0/pkg/texlive')
      .reply(200, json);
  };
});

afterAll(nock.restore);

describe('LatestRelease', () => {
  describe('checkVersion', () => {
    it('checks for latest version using the CTAN API', async () => {
      const mock = doMock();
      await expect(new Latest().checkVersion()).resolves.toBe(LATEST_VERSION);
      expect(mock.isDone()).toBe(true);
    });

    it('throws no exception', async () => {
      await expect(new Latest().checkVersion()).resolves.not.toThrow();
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check'),
      );
    });
  });
});

describe('ReleaseData.setup', () => {
  let mock: nock.Scope;
  beforeAll(() => {
    mock = doMock();
  });

  it('does not usually check for the latest version', async () => {
    await expect(ReleaseData.setup()).resolves.not.toThrow();
    expect(mock.isDone()).toBe(false);
  });

  it('checks for the latest version if needed', async () => {
    vi.spyOn(Temporal.Now, 'instant').mockReturnValueOnce(
      Temporal
        .PlainDateTime
        .from('2025-03-08')
        .toZonedDateTime('UTC')
        .toInstant(),
    );
    await expect(ReleaseData.setup()).resolves.not.toThrow();
    expect(mock.isDone()).toBe(true);
  });
});
