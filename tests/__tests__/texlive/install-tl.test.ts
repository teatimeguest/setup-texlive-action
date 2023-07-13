import os from 'node:os';

import * as tool from '@actions/tool-cache';

import * as log from '#/log';
import { download, restore } from '#/texlive/install-tl';
import { Version } from '#/texlive/version';
import * as util from '#/util';

const v = (spec: unknown) => new Version(`${spec}`);

jest.unmock('#/texlive/install-tl');

const fail = (): any => {
  throw new Error();
};

describe('restore', () => {
  it('uses cache if available', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(restore(v`latest`)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    expect(restore(v`latest`)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockImplementationOnce(fail);
    expect(restore(v`latest`)).toBeUndefined();
    expect(log.info).toHaveBeenCalled();
  });
});

describe('download', () => {
  const options = {
    version: v`latest`,
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
