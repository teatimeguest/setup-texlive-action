import { beforeAll, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';
import * as os from 'node:os';

import * as core from '@actions/core';
import * as tool from '@actions/tool-cache';

import { download, restoreCache } from '#/texlive/install-tl/cli';
import { Profile } from '#/texlive/install-tl/profile';
import * as util from '#/util';

vi.unmock('#/texlive/install-tl/cli');

const fail = (): any => {
  throw new Error();
};
const options = {
  profile: new Profile(LATEST_VERSION, { prefix: '' }),
  repository: new URL('https://example.com/'),
};

beforeAll(async () => {
  const releaseText = await fixtures('release-texlive.txt');
  vi.mocked(readFile).mockResolvedValue(releaseText);
});

describe('restore', () => {
  it('uses cache if available', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(restoreCache(options)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    expect(restoreCache(options)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(tool.find).mockImplementationOnce(fail);
    expect(restoreCache(options)).toBeUndefined();
    expect(core.info).toHaveBeenCalledTimes(2);
    expect(vi.mocked(core.info).mock.calls[1]?.[0]).toMatchInlineSnapshot(
      '"Failed to restore install-tl: Error"',
    );
  });
});

describe('download', () => {
  it('downloads installer', async () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    await download(options);
    expect(tool.downloadTool).toHaveBeenCalled();
    expect(util.extract).toHaveBeenCalled();
  });

  it('saves installer to cache', async () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    await download(options);
    expect(tool.cacheDir).toHaveBeenCalled();
  });

  it('does not fail even if tool.cacheDir fails', async () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(tool.cacheDir).mockImplementationOnce(fail);
    await expect(download(options)).toResolve();
    expect(core.info).toHaveBeenCalledTimes(5);
    expect(vi.mocked(core.info).mock.calls[0]?.[0]).toMatchInlineSnapshot(
      '"Downloading install-tl-unx.tar.gz from https://example.com/install-tl-unx.tar.gz"',
    );
    expect(vi.mocked(core.info).mock.calls[1]?.[0]).toMatchInlineSnapshot(
      '"Extracting install-tl from <downloadTool>"',
    );
    expect(vi.mocked(core.info).mock.calls[2]?.[0]).toMatchInlineSnapshot(
      '"Adding to tool cache"',
    );
    expect(vi.mocked(core.info).mock.calls[4]?.[0]).toMatchInlineSnapshot(
      '"Failed to cache install-tl: Error"',
    );
  });
});
