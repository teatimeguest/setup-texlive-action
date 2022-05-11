import * as os from 'os';
import * as path from 'path';
import * as process from 'process';

import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';

import { Env, InstallTL, Profile } from '#/install-tl';
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
(tool.downloadTool as jest.Mock).mockResolvedValue('<downloadTool>');
(util.extract as jest.Mock).mockResolvedValue('<extract>');
(util.tmpdir as jest.Mock).mockReturnValue('<tmpdir>');
(tl.historic as jest.Mock).mockImplementation(
  jest.requireActual<typeof tl>('#/texlive').historic,
);
jest.unmock('#/install-tl');

describe('InstallTL', () => {
  describe('run', () => {
    it('installs TeX Live 2008', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = await InstallTL.acquire('2008');
      await installtl.run(
        new Profile('2008', '/usr/local/texlive'),
        new Env('2008', '/usr/local/texlive'),
      );
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        [
          '-no-gui',
          '-profile',
          expect.stringMatching(/texlive\.profile$/u),
          '-location',
          'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
        ],
        expect.anything(),
      );
    });

    it('installs TeX Live 2012', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = await InstallTL.acquire('2012');
      await installtl.run(
        new Profile('2012', '/usr/local/texlive'),
        new Env('2012', '/usr/local/texlive'),
      );
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        [
          '-no-gui',
          '-profile',
          expect.stringMatching(/texlive\.profile$/u),
          '-repository',
          'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2012/tlnet-final/',
        ],
        expect.anything(),
      );
    });

    it(`installs TeX Live ${Version.LATEST}`, async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = await InstallTL.acquire(Version.LATEST);
      await installtl.run(
        new Profile(Version.LATEST, '/usr/local/texlive'),
        new Env(Version.LATEST, '/usr/local/texlive'),
      );
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        ['-no-gui', '-profile', expect.stringMatching(/texlive\.profile$/u)],
        expect.anything(),
      );
    });
  });

  describe('acquire', () => {
    it('downloads the installer on Linux', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
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
      (os.platform as jest.Mock).mockReturnValue('win32');
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
      (os.platform as jest.Mock).mockReturnValue('darwin');
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
      (os.platform as jest.Mock).mockReturnValue('linux');
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
      (os.platform as jest.Mock).mockReturnValue(platform);
      await expect(InstallTL.acquire(version)).rejects.toThrow(
        /^Installation of TeX Live \d{4} on (?:\w+) is not supported$/u,
      );
    });

    it('uses cache instead of downloading', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      (util.restoreToolCache as jest.Mock).mockReturnValueOnce('<dest>');
      await InstallTL.acquire(Version.LATEST);
      expect(tool.downloadTool).not.toHaveBeenCalled();
    });
  });
});

describe('Env', () => {
  describe('format', () => {
    it('returns a proper string', () => {
      process.env['TEXLIVE_INSTALL_ENV_NOCHECK'] = '';
      process.env['TEXLIVE_INSTALL_TEXMFCONFIG'] = '~/texmf-config';
      process.env['NOPERLDOC'] = '';
      expect(Env.format(new Env(Version.LATEST, '/usr/local/texlive'))).toBe(
        [
          "TEXLIVE_INSTALL_ENV_NOCHECK=''",
          "TEXLIVE_INSTALL_NO_WELCOME='true'",
          "TEXLIVE_INSTALL_PREFIX='/usr/local/texlive'",
          "TEXLIVE_INSTALL_TEXMFHOME='~/texmf'",
          "TEXLIVE_INSTALL_TEXMFCONFIG='~/texmf-config'",
          `TEXLIVE_INSTALL_TEXMFVAR='~/.local/texlive/${Version.LATEST}/texmf-var'`,
          "NOPERLDOC=''",
        ].join('\n'),
      );
    });
  });
});

describe('Profile', () => {
  describe('constructor', () => {
    it('creates a profile for TeX Live 2008', () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      expect(new Profile('2008', '/usr/local/texlive')).toMatchObject({
        TEXDIR: '/usr/local/texlive/2008',
        TEXMFLOCAL: '/usr/local/texlive/texmf-local',
        TEXMFSYSCONFIG: '/usr/local/texlive/2008/texmf-config',
        TEXMFSYSVAR: '/usr/local/texlive/2008/texmf-var',
        selected_scheme: 'scheme-minimal',
        option_adjustrepo: '0',
        option_autobackup: '0',
        option_desktop_integration: '0',
        option_doc: '0',
        option_file_assocs: '0',
        option_menu_integration: '0',
        option_path: '0',
        option_src: '0',
        option_symlinks: '0',
        option_w32_multi_user: '0',
      });
    });

    it('creates a profile for TeX Live 2016', () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      expect(new Profile('2016', '/usr/local/texlive')).toMatchObject({
        TEXDIR: '/usr/local/texlive/2016',
        TEXMFLOCAL: '/usr/local/texlive/texmf-local',
        TEXMFSYSCONFIG: '/usr/local/texlive/2016/texmf-config',
        TEXMFSYSVAR: '/usr/local/texlive/2016/texmf-var',
        selected_scheme: 'scheme-infraonly',
        option_adjustrepo: '0',
        option_autobackup: '0',
        option_desktop_integration: '0',
        option_doc: '0',
        option_file_assocs: '0',
        option_menu_integration: '0',
        option_path: '0',
        option_src: '0',
        option_symlinks: '0',
        option_w32_multi_user: '0',
      });
    });

    it('creates a profile for TeX Live 2021', () => {
      (os.platform as jest.Mock).mockReturnValue('win32');
      expect(new Profile(Version.LATEST, 'C:\\texlive')).toMatchObject({
        TEXDIR: `C:\\texlive\\${Version.LATEST}`,
        TEXMFLOCAL: 'C:\\texlive\\texmf-local',
        TEXMFSYSCONFIG: `C:\\texlive\\${Version.LATEST}\\texmf-config`,
        TEXMFSYSVAR: `C:\\texlive\\${Version.LATEST}\\texmf-var`,
        selected_scheme: 'scheme-infraonly',
        option_adjustrepo: '1',
        option_autobackup: '0',
        option_desktop_integration: '0',
        option_doc: '0',
        option_file_assocs: '0',
        option_menu_integration: '0',
        option_path: '0',
        option_src: '0',
        option_symlinks: '0',
        option_w32_multi_user: '0',
      });
    });
  });

  describe('format', () => {
    it('returns a profile string', () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      expect(
        Profile.format(new Profile(Version.LATEST, '/usr/local/texlive')),
      ).toBe(
        [
          `TEXDIR /usr/local/texlive/${Version.LATEST}`,
          'TEXMFLOCAL /usr/local/texlive/texmf-local',
          `TEXMFSYSCONFIG /usr/local/texlive/${Version.LATEST}/texmf-config`,
          `TEXMFSYSVAR /usr/local/texlive/${Version.LATEST}/texmf-var`,
          'selected_scheme scheme-infraonly',
          'option_adjustrepo 1',
          'option_autobackup 0',
          'option_desktop_integration 0',
          'option_doc 0',
          'option_file_assocs 0',
          'option_menu_integration 0',
          'option_path 0',
          'option_src 0',
          'option_symlinks 0',
          'option_w32_multi_user 0',
        ].join('\n'),
      );
    });
  });
});

describe('executable', () => {
  it(`returns the filename for TeX Live ${Version.LATEST} on Linux`, async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    const installtl = await InstallTL.acquire(Version.LATEST);
    await installtl.run(
      new Profile(Version.LATEST, '/usr/local/texlive'),
      new Env(Version.LATEST, '/usr/local/texlive'),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2012 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = await InstallTL.acquire('2012');
    await installtl.run(
      new Profile('2012', 'C:\\texlive'),
      new Env('2012', 'C:\\texlive'),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl\.bat$/u),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2016 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = await InstallTL.acquire('2016');
    await installtl.run(
      new Profile('2016', 'C:\\texlive'),
      new Env('2016', 'C:\\texlive'),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl-windows\.bat$/u),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('repository', () => {
  it('returns the url for the latest TeX Live', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire(Version.LATEST);
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining(`/${Version.LATEST}/install-tl-unx.tar.gz`),
    );
  });

  it('returns the url for TeX Live 2008', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet/install-tl-unx.tar.gz'),
    );
  });

  it('returns the url for TeX Live 2010', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2010');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet-final/install-tl-unx.tar.gz'),
    );
  });

  it('returns the url for TeX Live 2018', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2018');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringContaining('/tlnet-final/install-tl-unx.tar.gz'),
    );
  });
});

describe('patch', () => {
  it('does not fail even if `install-tl(-windows).bat` does not exist', async () => {
    jest
      .spyOn(util, 'updateFile')
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          (error as { code?: string }).code = 'ENOENT';
          throw error;
        }
      });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).resolves.not.toThrow();
  });

  it('rethrows an error that is not of Node.js', async () => {
    jest
      .spyOn(util, 'updateFile')
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          throw error;
        }
      });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });

  it('rethrows a Node.js error of which code is not `ENOENT`', async () => {
    jest
      .spyOn(util, 'updateFile')
      .mockImplementation(async (filename: string) => {
        if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
          const error = new Error('oops');
          (error as NodeJS.ErrnoException).code = 'ENOTDIR';
          throw error;
        }
      });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });
});
