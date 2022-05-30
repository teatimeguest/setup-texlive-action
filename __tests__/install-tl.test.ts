import * as os from 'os';
import * as path from 'path';

import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tool from '@actions/tool-cache';
import 'jest-extended';

import { InstallTL, Profile } from '#/install-tl';
import * as tl from '#/texlive';
import Version = tl.Version;
import * as util from '#/utility';

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(async (template: string) => template + 'XXXXXX'),
  readFile: jest.fn(),
  stat: jest.fn(), // required for @azure/storage-blob
  writeFile: jest.fn(),
}));
jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('~'),
  platform: jest.fn(),
}));
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    join: jest.fn((...paths: Array<string>) => {
      return os.platform() === 'win32'
        ? path.win32.join(...paths)
        : path.posix.join(...paths);
    }),
    posix: actual.posix,
    win32: actual.win32,
  };
});
jest.mock('process', () => ({ env: {} }));
jest.mocked(tool.downloadTool).mockResolvedValue('<downloadTool>');
jest.mocked(util.extract).mockResolvedValue('<extract>');
jest.mocked(util.tmpdir).mockReturnValue('<tmpdir>');
jest
  .mocked(tl.historic)
  .mockImplementation(jest.requireActual<typeof tl>('#/texlive').historic);
jest.unmock('#/install-tl');

describe('InstallTL', () => {
  describe('run', () => {
    it('installs TeX Live 2008', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = await InstallTL.acquire('2008');
      await installtl.run(new Profile('2008', '/usr/local/texlive'));
      expect(exec.exec).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ]);
    });

    it('installs TeX Live 2012', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = await InstallTL.acquire('2012');
      await installtl.run(new Profile('2012', '/usr/local/texlive'));
      expect(exec.exec).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2012/tlnet-final/',
      ]);
    });

    it(`installs TeX Live ${Version.LATEST}`, async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const installtl = await InstallTL.acquire(Version.LATEST);
      await installtl.run(new Profile(Version.LATEST, '/usr/local/texlive'));
      expect(exec.exec).toHaveBeenCalledWith(expect.stringContaining(''), [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
      ]);
    });
  });

  describe('acquire', () => {
    it('downloads the installer on Linux', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        expect.stringContaining(`/${Version.LATEST}/install-tl-unx.tar.gz`),
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it('downloads the installer on Windows', async () => {
      jest.mocked(os.platform).mockReturnValue('win32');
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl.zip',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        expect.stringContaining(`/${Version.LATEST}/install-tl.zip`),
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it('downloads the installer on macOS', async () => {
      jest.mocked(os.platform).mockReturnValue('darwin');
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        expect.stringContaining(`/${Version.LATEST}/install-tl-unx.tar.gz`),
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it('downloads the installer for TeX Live 2008', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      await InstallTL.acquire('2008');
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        '2008',
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        expect.stringContaining('/tlnet/install-tl-unx.tar.gz'),
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it.each<[Version, NodeJS.Platform]>([
      ['2007', 'linux'],
      ['2007', 'win32'],
      ['2012', 'darwin'],
    ])('does not support TeX Live %s on %s', async (version, platform) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(InstallTL.acquire(version)).rejects.toThrow(
        /^Installation of TeX Live \d{4} on (?:\w+) is not supported$/u,
      );
    });

    it('uses cache instead of downloading', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      jest.mocked(util.restoreToolCache).mockResolvedValueOnce('<dest>');
      await InstallTL.acquire(Version.LATEST);
      expect(tool.downloadTool).not.toHaveBeenCalled();
    });
  });
});

describe('Profile', () => {
  describe('constructor', () => {
    beforeEach(() => {
      jest.mocked(os.platform).mockReturnValue('linux');
    });

    it('uses scheme-infraonly by default', () => {
      expect(new Profile(Version.LATEST, '')).toHaveProperty(
        'selected_scheme',
        'scheme-infraonly',
      );
    });

    it('uses scheme-minimal for versions prior to 2016', () => {
      expect(new Profile('2008', '')).toHaveProperty(
        'selected_scheme',
        'scheme-minimal',
      );
    });

    it('sets TEXMF properly', () => {
      const profile = new Profile(Version.LATEST, '/usr/local/texlive');
      expect(profile).toHaveProperty(
        'TEXDIR',
        `/usr/local/texlive/${Version.LATEST}`,
      );
      expect(profile).toHaveProperty(
        'TEXMFLOCAL',
        '/usr/local/texlive/texmf-local',
      );
      expect(profile).toHaveProperty(
        'TEXMFSYSCONFIG',
        `/usr/local/texlive/${Version.LATEST}/texmf-config`,
      );
    });

    it('sets instopt_adjustrepo to true for the latest version', () => {
      expect(new Profile(Version.LATEST, '')).toHaveProperty(
        'instopt_adjustrepo',
        true,
      );
    });

    it('sets instopt_adjustrepo to false for an older version', () => {
      expect(new Profile('2018', '')).toHaveProperty(
        'instopt_adjustrepo',
        false,
      );
    });
  });

  describe('toString', () => {
    it('does not emits Windows-only options on Linux', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, '').toString();
      expect(profile).not.toMatch('desktop_integration');
      expect(profile).not.toMatch('file_assocs');
    });

    it('emits Windows-only options on Windows', () => {
      jest.mocked(os.platform).mockReturnValue('win32');
      const profile = new Profile(Version.LATEST, '').toString();
      expect(profile).toMatch(/^tlpdbopt_desktop_integration 0$/mu);
      expect(profile).toMatch(/^tlpdbopt_w32_multi_user 0$/mu);
    });

    it('uses old option names for an older version', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile('2010', '').toString();
      expect(profile).toMatch(/^option_/mu);
      expect(profile).not.toMatch(/^instopt_/mu);
      expect(profile).not.toMatch(/^tlpdbopt_/mu);
    });

    it('converts boolean to number', () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile('2015', '').toString();
      expect(profile).toMatch(/ [01]$/mu);
      expect(profile).not.toMatch(/ (?:true|false)$/mu);
    });
  });

  describe('open', () => {
    it('yields file path only once', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, '');
      for await (const dest of profile.open()) {
        expect(dest).pass('');
      }
      expect.assertions(1);
    });

    it('deletes temporary directory', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, '');
      for await (const dest of profile.open()) {
        expect(dest).pass('');
      }
      expect(io.rmRF).toHaveBeenCalled();
    });

    it('deletes temporary directory even if an exception thrown', async () => {
      jest.mocked(os.platform).mockReturnValue('linux');
      const profile = new Profile(Version.LATEST, '');
      await expect(
        (async () => {
          for await (const dest of profile.open()) {
            throw new Error(dest);
          }
        })(),
      ).toReject();
      expect(io.rmRF).toHaveBeenCalled();
    });
  });
});

describe('executable', () => {
  it(`returns the filename for TeX Live ${Version.LATEST} on Linux`, async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    const installtl = await InstallTL.acquire(Version.LATEST);
    await installtl.run(new Profile(Version.LATEST, '/usr/local/texlive'));
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2012 on Windows', async () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    const installtl = await InstallTL.acquire('2012');
    await installtl.run(new Profile('2012', 'C:\\texlive'));
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl\.bat$/u),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2016 on Windows', async () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    const installtl = await InstallTL.acquire('2016');
    await installtl.run(new Profile('2016', 'C:\\texlive'));
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl-windows\.bat$/u),
      expect.anything(),
    );
  });
});

describe('repository', () => {
  it('returns the url for the latest TeX Live', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.acquire(Version.LATEST);
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining(`/${Version.LATEST}/install-tl-unx.tar.gz`),
    );
  });

  it('returns the url for TeX Live 2008', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.acquire('2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet/install-tl-unx.tar.gz'),
    );
  });

  it('returns the url for TeX Live 2010', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.acquire('2010');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet-final/install-tl-unx.tar.gz'),
    );
  });

  it('returns the url for TeX Live 2018', async () => {
    jest.mocked(os.platform).mockReturnValue('linux');
    await InstallTL.acquire('2018');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet-final/install-tl-unx.tar.gz'),
    );
  });
});

describe('patch', () => {
  it('does not fail even if `install-tl(-windows).bat` does not exist', async () => {
    jest
      .mocked(util.updateFile)
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          (error as { code?: string }).code = 'ENOENT';
          throw error;
        }
      });
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).resolves.not.toThrow();
  });

  it('rethrows an error that is not of Node.js', async () => {
    jest
      .mocked(util.updateFile)
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          throw error;
        }
      });
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });

  it('rethrows a Node.js error of which code is not `ENOENT`', async () => {
    jest
      .mocked(util.updateFile)
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          (error as NodeJS.ErrnoException).code = 'ENOTDIR';
          throw error;
        }
      });
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });
});
