import os from 'node:os';

import * as tool from '@actions/tool-cache';

import * as log from '#/log';
import { download, restore } from '#/texlive/install-tl';
import * as util from '#/util';

jest.unmock('#/texlive/install-tl');

const fail = (): any => {
  throw new Error();
};

describe('restore', () => {
  it('uses cache if available', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(restore(LATEST_VERSION)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    expect(restore(LATEST_VERSION)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockImplementationOnce(fail);
    expect(restore(LATEST_VERSION)).toBeUndefined();
    expect(log.info).toHaveBeenCalled();
  });
});

describe('download', () => {
  const options = {
    version: LATEST_VERSION,
    repository: new URL('https://example.com/'),
  };
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
