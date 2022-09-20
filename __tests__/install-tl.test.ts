import fs from 'node:fs/promises';
import os from 'node:os';

import { getExecOutput } from '@actions/exec';
import { rmRF } from '@actions/io';
import * as tool from '@actions/tool-cache';
import 'jest-extended';

import { InstallTL, Profile } from '#/install-tl';
import * as log from '#/log';
import { Version } from '#/texlive';
import * as util from '#/utility';

jest.mock('node:fs/promises', () => ({
  mkdtemp: jest.fn(async (template: string) => template + 'XXXXXX'),
  readFile: jest.fn().mockReturnValue(''),
  stat: jest.fn(), // required for @azure/storage-blob
  writeFile: jest.fn(),
}));
jest.mock(
  'node:os',
  () => ({ homedir: jest.fn().mockReturnValue('~'), platform: jest.fn() }),
);
jest.mock('node:path', () => {
  const { posix, win32 } = jest.requireActual('path');
  return {
    join: jest.fn((...paths) => {
      return (os.platform() === 'win32' ? win32 : posix).join(...paths);
    }),
    posix,
  };
});
jest.mock('node:process', () => ({ env: {} }));
jest.mocked(getExecOutput).mockResolvedValue({
  exitCode: 0,
  stdout: '',
  stderr: '',
});
jest.mocked(tool.find).mockReturnValue('');
jest.mocked(tool.downloadTool).mockResolvedValue('<downloadTool>');
jest.mock(
  '#/utility',
  () => ({
    Serializable: jest.requireActual('#/utility').Serializable,
    extract: jest.fn().mockResolvedValue('<extract>'),
    tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
  }),
);
jest.mock('#/texlive', () => {
  const { Version, tlnet, tlpkg } = jest.requireActual('#/texlive');
  return { Version, tlnet, tlpkg };
});
jest.unmock('#/install-tl');
jest.spyOn(InstallTL, 'download');

const fail = (): any => {
  throw new Error();
};

const texmf = {
  TEXDIR: 'TEXDIR',
  TEXMFLOCAL: 'TEXMFLOCAL',
  TEXMFHOME: 'TEXMFHOME',
  TEXMFCONFIG: 'TEXMFCONFIG',
  TEXMFVAR: 'TEXMFVAR',
};

describe('InstallTL', () => {
  describe('run', () => {
    it('installs TeX Live 2008', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = new (InstallTL as any)('2008', '');
      await installtl.run(new Profile('2008', texmf));
      expect(getExecOutput).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ]);
    });

    it('installs TeX Live 2012', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = new (InstallTL as any)('2012', '');
      await installtl.run(new Profile('2012', texmf));
      expect(getExecOutput).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2012/tlnet-final/',
      ]);
    });

    it(`installs TeX Live ${Version.LATEST}`, async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = new (InstallTL as any)(Version.LATEST, '');
      await installtl.run(new Profile(Version.LATEST, texmf));
      expect(getExecOutput).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
      ]);
    });
  });

  describe('restore', () => {
    it('uses cache if available', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      jest.mocked(tool.find).mockReturnValueOnce('<cache>');
      expect(InstallTL.restore(Version.LATEST)).toBeDefined();
    });

    it('returns undefined if cache not found', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      expect(InstallTL.restore(Version.LATEST)).toBeUndefined();
    });

    it('does not fail even if tool.find fails', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      jest.mocked(tool.find).mockImplementationOnce(fail);
      expect(InstallTL.restore(Version.LATEST)).toBeUndefined();
      expect(log.info).toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('downloads installer', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      await InstallTL.download(Version.LATEST);
      expect(tool.downloadTool).toHaveBeenCalled();
      expect(util.extract).toHaveBeenCalled();
    });

    it('saves installer to cache', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      await InstallTL.download(Version.LATEST);
      expect(tool.cacheDir).toHaveBeenCalled();
    });

    it('does not fail even if tool.cacheDir fails', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      jest.mocked(tool.cacheDir).mockImplementationOnce(fail);
      await expect(InstallTL.download(Version.LATEST)).toResolve();
      expect(log.info).toHaveBeenCalled();
    });

    it.each<[Version]>([['2008'], ['2011'], ['2014'], ['2017'], ['2020']])(
      'applies a patch for install-tl(-windows).bat on Windows (%s)',
      async (version) => {
        jest.mocked(os.platform).mockReturnValue('win32');
        await expect(InstallTL.download(version)).toResolve();
        expect(fs.readFile).toHaveBeenCalledWith(
          expect.stringMatching(/install-tl(?:-windows)?\.bat/u),
          'utf8',
        );
      },
    );

    it.each<[NodeJS.Platform, Version]>([['linux', '2009'], ['linux', '2010'], [
      'win32',
      '2009',
    ], ['win32', '2010']])(
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
      await expect(InstallTL.download('2015')).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('Alias.pm'),
        'utf8',
      );
    });

    it.each<[NodeJS.Platform, Version]>([
      ['win32', '2008'],
      ['win32', '2011'],
      ['win32', '2014'],
      ['win32', '2017'],
      ['darwin', '2017'],
      ['darwin', '2018'],
      ['darwin', '2019'],
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
});

describe('Profile', () => {
  describe('constructor', () => {
    beforeEach(() => {
      jest.mocked(os.platform).mockReturnValue('linux');
    });

    it('uses scheme-infraonly by default', () => {
      expect(new Profile(Version.LATEST, texmf)).toHaveProperty(
        'selected_scheme',
        'scheme-infraonly',
      );
    });

    it('uses scheme-minimal for versions prior to 2016', () => {
      expect(new Profile('2008', texmf)).toHaveProperty(
        'selected_scheme',
        'scheme-minimal',
      );
    });

    it('sets instopt_adjustrepo to true for the latest version', () => {
      expect(new Profile(Version.LATEST, texmf)).toHaveProperty(
        'instopt_adjustrepo',
        true,
      );
    });

    it('sets instopt_adjustrepo to false for an older version', () => {
      expect(new Profile('2018', texmf)).toHaveProperty(
        'instopt_adjustrepo',
        false,
      );
    });
  });

  describe('toString', () => {
    it('does not emits Windows-only options on Linux', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, texmf).toString();
      expect(profile).not.toMatch('desktop_integration');
      expect(profile).not.toMatch('file_assocs');
    });

    it('emits Windows-only options on Windows', () => {
      jest.mocked(os.platform).mockReturnValue('win32');
      const profile = new Profile(Version.LATEST, texmf).toString();
      expect(profile).toMatch(/^tlpdbopt_desktop_integration 0$/mu);
      expect(profile).toMatch(/^tlpdbopt_w32_multi_user 0$/mu);
    });

    it('uses old option names for an older version', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile('2010', texmf).toString();
      expect(profile).toMatch(/^option_/mu);
      expect(profile).not.toMatch(/^instopt_/mu);
      expect(profile).not.toMatch(/^tlpdbopt_/mu);
    });

    it('converts boolean to number', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile('2015', texmf).toString();
      expect(profile).toMatch(/ [01]$/mu);
      expect(profile).not.toMatch(/ (?:true|false)$/mu);
    });
  });

  describe('open', () => {
    it('yields file path only once', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, texmf);
      for await (const dest of profile.open()) {
        expect(dest).pass('');
      }
      expect.assertions(1);
    });

    it('deletes temporary directory', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, texmf);
      for await (const dest of profile.open()) {
        expect(dest).pass('');
      }
      expect(rmRF).toHaveBeenCalled();
    });

    it('deletes temporary directory even if an exception thrown', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, texmf);
      await expect(
        (async () => {
          for await (const dest of profile.open()) {
            throw new Error(dest);
          }
        })(),
      )
        .toReject();
      expect(rmRF).toHaveBeenCalled();
    });
  });
});
