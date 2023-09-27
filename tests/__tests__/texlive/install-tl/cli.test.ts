import { readFile } from 'node:fs/promises';
import os from 'node:os';

import * as tool from '@actions/tool-cache';

import * as log from '#/log';
import { download, restoreCache } from '#/texlive/install-tl/cli';
import { Profile } from '#/texlive/install-tl/profile';
import * as util from '#/util';

jest.unmock('#/texlive/install-tl/cli');

const fail = (): any => {
  throw new Error();
};
const options = {
  profile: new Profile(LATEST_VERSION, { prefix: '' }),
  repository: new URL('https://example.com/'),
};

beforeAll(async () => {
  const releaseText = await fixtures('release-texlive.txt');
  jest.mocked(readFile).mockResolvedValue(releaseText);
});

describe('restore', () => {
  it('uses cache if available', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(restoreCache(options)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    expect(restoreCache(options)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockImplementationOnce(fail);
    expect(restoreCache(options)).toBeUndefined();
    expect(log.info).toHaveBeenCalled();
  });
});

describe('download', () => {
  it('downloads installer', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await download(options);
    expect(tool.downloadTool).toHaveBeenCalled();
    expect(util.extract).toHaveBeenCalled();
  });

  it('saves installer to cache', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await download(options);
    expect(tool.cacheDir).toHaveBeenCalled();
  });

  it('does not fail even if tool.cacheDir fails', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.cacheDir).mockImplementationOnce(fail);
    await expect(download(options)).toResolve();
    expect(log.info).toHaveBeenCalled();
  });
});
