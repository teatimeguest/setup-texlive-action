import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile } from 'node:fs/promises';
import * as os from 'node:os';

import * as core from '@actions/core';
import * as tool from '@actions/tool-cache';
import releaseText from '@setup-texlive-action/fixtures/release-texlive.txt?raw';
import * as util from '@setup-texlive-action/utils';

import { acquire, restoreCache } from '#texlive/install-tl/cli';

vi.unmock('#texlive/install-tl/cli');

const fail = (): any => {
  throw new Error();
};

const options = {
  version: '2023',
  repository: new URL(MOCK_URL),
} as const;

beforeAll(() => {
  vi.mocked(readFile).mockResolvedValue(releaseText);
});

beforeEach(() => {
  vi.mocked(os.platform).mockReturnValue('linux');
});

describe('restore', () => {
  it('uses cache if available', () => {
    vi.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(restoreCache(options.version)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    expect(restoreCache(options.version)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    vi.mocked(tool.find).mockImplementationOnce(fail);
    expect(restoreCache(options.version)).toBeUndefined();
    expect(core.info).toHaveBeenCalledTimes(2);
    expect(vi.mocked(core.info).mock.calls[1]?.[0]).toMatchInlineSnapshot(
      '"Failed to restore install-tl: Error"',
    );
  });
});

describe('acquire', () => {
  it('downloads installer', async () => {
    await acquire(options);
    expect(tool.downloadTool).toHaveBeenCalled();
    expect(util.extract).toHaveBeenCalled();
  });

  it('saves installer to cache', async () => {
    await acquire(options);
    expect(tool.cacheDir).toHaveBeenCalled();
  });

  it('does not fail even if tool.cacheDir fails', async () => {
    vi.mocked(tool.cacheDir).mockImplementationOnce(fail);
    await expect(acquire(options)).resolves.not.toThrow();
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

  it('infers version', async () => {
    await expect(acquire({ repository: options.repository }))
      .resolves
      .toHaveProperty('version', options.version);
  });
});
