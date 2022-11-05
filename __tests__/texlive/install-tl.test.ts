import fs from 'node:fs/promises';
import os from 'node:os';

import * as tool from '@actions/tool-cache';

import * as log from '#/log';
import { InstallTL } from '#/texlive/install-tl';
import { Version } from '#/texlive/version';
import * as util from '#/utility';

const v = (spec: unknown) => new Version(`${spec}`);

jest.unmock('#/texlive/install-tl');
jest.spyOn(InstallTL, 'download');

const fail = (): any => {
  throw new Error();
};

describe('restore', () => {
  it('uses cache if available', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockReturnValueOnce('<cache>');
    expect(InstallTL.restore(v`latest`)).toBeDefined();
  });

  it('returns undefined if cache not found', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    expect(InstallTL.restore(v`latest`)).toBeUndefined();
  });

  it('does not fail even if tool.find fails', () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.find).mockImplementationOnce(fail);
    expect(InstallTL.restore(v`latest`)).toBeUndefined();
    expect(log.info).toHaveBeenCalled();
  });
});

describe('download', () => {
  it('downloads installer', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.download(v`latest`);
    expect(tool.downloadTool).toHaveBeenCalled();
    expect(util.extract).toHaveBeenCalled();
  });

  it('saves installer to cache', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.download(v`latest`);
    expect(tool.cacheDir).toHaveBeenCalled();
  });

  it('does not fail even if tool.cacheDir fails', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    jest.mocked(tool.cacheDir).mockImplementationOnce(fail);
    await expect(InstallTL.download(v`latest`)).toResolve();
    expect(log.info).toHaveBeenCalled();
  });

  it.each<[NodeJS.Platform, Version]>([
    ['linux', v`2009`],
    ['linux', v`2010`],
    ['win32', v`2009`],
    ['win32', v`2010`],
  ])(
    'applies a patch for tlpkg/TeXLive/TLWinGoo.pm on (%s %s)',
    async (platform, version) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(InstallTL.download(version)).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLWinGoo.pm'),
        'utf8',
      );
    },
  );

  it('applies a patch for tlpkg/tlperl/lib/Encode/Alias.pm', async () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(InstallTL.download(v`2015`)).toResolve();
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Alias.pm'),
      'utf8',
    );
  });

  it.each<[NodeJS.Platform, Version]>([
    ['win32', v`2008`],
    ['win32', v`2011`],
    ['win32', v`2014`],
    ['win32', v`2017`],
    ['darwin', v`2017`],
    ['darwin', v`2018`],
    ['darwin', v`2019`],
  ])(
    'applies a patch tlpkg/TeXLive/TLUtils.pm (%s %s)',
    async (platform, version) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(InstallTL.download(version)).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLUtils.pm'),
        'utf8',
      );
    },
  );
});
