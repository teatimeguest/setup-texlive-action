import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';

import { Env, InstallTL, Profile } from '#/install-tl';
import { Version } from '#/texlive';
import * as util from '#/utility';

jest.mock('fs', () => ({
  promises: jest.createMockFromModule('fs/promises'),
  stat: jest.fn(), // required for @azure/storage-blob
}));
(fs.mkdtemp as jest.Mock).mockImplementation(
  async (template: string) => template + 'XXXXXX',
);
jest.mock('os');
(os.homedir as jest.Mock).mockReturnValue('~');
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
(tool.downloadTool as jest.Mock).mockResolvedValue('<downloadTool>');
(util.extract as jest.Mock).mockResolvedValue('<extract>');
(util.tmpdir as jest.Mock).mockReturnValue('<tmpdir>');
jest.unmock('#/install-tl');

beforeEach(() => {
  process.env = {};
});

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
    const setVersion = (version: string): void => {
      (fs.readFile as jest.Mock).mockResolvedValueOnce(
        `TeX Live (https://tug.org/texlive) version ${version}`,
      );
    };

    it('downloads the installer on Linux', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      setVersion(Version.LATEST);
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it('downloads the installer on Windows', async () => {
      (os.platform as jest.Mock).mockReturnValue('win32');
      setVersion(Version.LATEST);
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl.zip',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl.zip',
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it('downloads the installer on macOS', async () => {
      (os.platform as jest.Mock).mockReturnValue('darwin');
      setVersion(Version.LATEST);
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.downloadTool).toHaveBeenCalledTimes(1);
      expect(util.extract).toHaveBeenCalled();
      expect(util.saveToolCache).toHaveBeenCalled();
    });

    it(`re-downloads the installer if the latest version is not ${Version.LATEST}`, async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      setVersion('2050');
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${Version.LATEST}/install-tl-unx.tar.gz`,
      );
      expect(util.extract).toHaveBeenCalledTimes(2);
      expect(util.saveToolCache).toHaveBeenCalledTimes(1);
    });

    it('re-downloads the installer if version checking is failed', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      (fs.readFile as jest.Mock).mockImplementationOnce(async () => {
        throw new Error('oops');
      });
      await InstallTL.acquire(Version.LATEST);
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        Version.LATEST,
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${Version.LATEST}/install-tl-unx.tar.gz`,
      );
      expect(util.extract).toHaveBeenCalledTimes(2);
      expect(util.saveToolCache).toHaveBeenCalledTimes(1);
    });

    it('downloads the installer for TeX Live 2008', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      await InstallTL.acquire('2008');
      expect(util.restoreToolCache).toHaveBeenCalledWith(
        'install-tl-unx.tar.gz',
        '2008',
      );
      expect(tool.downloadTool).toHaveBeenCalledWith(
        `http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl-unx.tar.gz`,
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
  it('returns the url of the ctan', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire(Version.LATEST);
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        '^https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      ),
    );
  });

  it('returns the url for TeX Live 2008', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl-unx.tar.gz$',
      ),
    );
  });

  it('returns the url for TeX Live 2010', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2010');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2010/tlnet-final/install-tl-unx.tar.gz$',
      ),
    );
  });

  it('returns the url for TeX Live 2018', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2018');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2018/tlnet-final/install-tl-unx.tar.gz$',
      ),
    );
  });
});

describe('patch', () => {
  beforeEach(() => {
    (util.updateFile as jest.Mock).mockImplementation(
      jest.requireActual('#/utility').updateFile as () => unknown,
    );
  });

  afterEach(() => {
    (util.updateFile as jest.Mock).mockImplementation();
  });

  it('applies a patch to `install-tl(-windows).bat`', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(
      [
        String.raw`if %ver_str:~,3% == 6.0 (`,
        String.raw`  echo WARNING: Windows 7 is the earliest supported version.`,
        String.raw`  echo TeX Live 2020 has not been tested on Windows Vista.`,
        String.raw`  pause`,
        String.raw`)`,
        String.raw``,
        String.raw`rem Start installer`,
        String.raw`if %tcl% == yes (`,
        String.raw`rem echo "%wish%" "%instroot%tlpkg\installer\install-tl-gui.tcl" -- %args%`,
        String.raw`rem pause`,
        String.raw`"%wish%" "%instroot%tlpkg\installer\install-tl-gui.tcl" -- %args%`,
        String.raw`) else (`,
        String.raw`rem echo perl "%instroot%install-tl" %args%`,
        String.raw`rem pause`,
        String.raw`perl "%instroot%install-tl" %args%`,
        String.raw`)`,
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('win32');
    await InstallTL.acquire(Version.LATEST);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl(?:-windows)?\.bat/u),
      [
        String.raw`if %ver_str:~,3% == 6.0 (`,
        String.raw`  echo WARNING: Windows 7 is the earliest supported version.`,
        String.raw`  echo TeX Live 2020 has not been tested on Windows Vista.`,
        String.raw`  `,
        String.raw`)`,
        String.raw``,
        String.raw`rem Start installer`,
        String.raw`if %tcl% == yes (`,
        String.raw`rem echo "%wish%" "%instroot%tlpkg\installer\install-tl-gui.tcl" -- %args%`,
        String.raw`rem `,
        String.raw`"%wish%" "%instroot%tlpkg\installer\install-tl-gui.tcl" -- %args%`,
        String.raw`) else (`,
        String.raw`rem echo perl "%instroot%install-tl" %args%`,
        String.raw`rem `,
        String.raw`perl "%instroot%install-tl" %args%`,
        String.raw`)`,
      ].join('\n'),
    );
  });

  it('does not fail even if `install-tl(-windows).bat` does not exist', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        (error as { code?: string }).code = 'ENOENT';
        throw error;
      }
      return '';
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).resolves.not.toThrow();
  });

  it('rethrows an error that is not of Node.js', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        throw error;
      }
      return '';
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });

  it('rethrows a Node.js error of which code is not `ENOENT`', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        (error as NodeJS.ErrnoException).code = 'ENOTDIR';
        throw error;
      }
      return '';
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(InstallTL.acquire(Version.LATEST)).rejects.toThrow('oops');
  });

  it('applies a patch to `tlpkg/TeXLive/TLWinGoo.pm`', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(
      [
        String.raw`  $sr = $sr . '/' unless $sr =~ m!/$!;`,
        String.raw`  return 0 if index($d, $sr)==0;`,
        String.raw`  foreach $p qw(luatex.exe mktexlsr.exe pdftex.exe tex.exe xetex.exe) {`,
        String.raw`    return 1 if (-e $d.$p);`,
        String.raw`  }`,
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.acquire('2010');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/tlpkg.TeXLive.TLWinGoo\.pm$/u),
      [
        String.raw`  $sr = $sr . '/' unless $sr =~ m!/$!;`,
        String.raw`  return 0 if index($d, $sr)==0;`,
        String.raw`  foreach $p (qw(luatex.exe mktexlsr.exe pdftex.exe tex.exe xetex.exe)) {`,
        String.raw`    return 1 if (-e $d.$p);`,
        String.raw`  }`,
      ].join('\n'),
    );
  });

  it('applies a patch to `tlpkg/tlperl/lib/Encode/Alias.pm`', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(
      [
        String.raw`    }`,
        String.raw``,
        String.raw`    # utf8 is blessed :)`,
        String.raw`    define_alias( qr/\bUTF-8$/i => '"utf-8-strict"' );`,
        String.raw``,
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('win32');
    await InstallTL.acquire('2015');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/tlpkg.tlperl.lib.Encode.Alias\.pm$/u),
      [
        String.raw`    }`,
        String.raw``,
        String.raw`    # utf8 is blessed :)`,
        String.raw`    define_alias(qr/cp65001/i => '"utf-8-strict"');`,
        String.raw`    define_alias( qr/\bUTF-8$/i => '"utf-8-strict"' );`,
        String.raw``,
      ].join('\n'),
    );
  });

  it('applies a patch to `tlpkg/TeXLive/TLUtils.pm` on Windows', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(
      [
        String.raw`    $subdir = $& if ( win32() && ($tree =~ s!^//[^/]+/!!) );`,
        String.raw``,
        String.raw`    @dirs = split (/\//, $tree);`,
        String.raw`    for my $dir (@dirs) {`,
        String.raw`      $subdir .= "$dir/";`,
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('win32');
    await InstallTL.acquire('2018');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/tlpkg.TeXLive.TLUtils\.pm$/u),
      [
        String.raw`    $subdir = $& if ( win32() && ($tree =~ s!^//[^/]+/!!) );`,
        String.raw``,
        String.raw`    @dirs = split (/[\/\\]/, $tree);`,
        String.raw`    for my $dir (@dirs) {`,
        String.raw`      $subdir .= "$dir/";`,
      ].join('\n'),
    );
  });

  it('applies a patch to `tlpkg/TeXLive/TLUtils.pm` on macOS', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue(
      // prettier-ignore
      [
                  '    chomp (my $sw_vers = `sw_vers -productVersion`);',
        String.raw`    my ($os_major,$os_minor) = split (/\./, $sw_vers);`,
        String.raw`    if ($os_major != 10) {`,
        String.raw`      warn "$0: only MacOSX is supported, not $OS $os_major.$os_minor "`,
        String.raw`           . " (from sw_vers -productVersion: $sw_vers)\n";`,
        String.raw`      return "unknown-unknown";`,
        String.raw`    }`,
        String.raw`    if ($os_minor >= $mactex_darwin) {`,
        String.raw`      ; # current version, default is ok (x86_64-darwin).`,
        String.raw`    } elsif ($os_minor >= 6 && $os_minor < $mactex_darwin) {`,
      ].join('\n'),
    );
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await InstallTL.acquire('2018');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/tlpkg.TeXLive.TLUtils\.pm$/u),
      // prettier-ignore
      [
                  '    chomp (my $sw_vers = `sw_vers -productVersion`);',
        String.raw`    my ($os_major,$os_minor) = split (/\./, $sw_vers);`,
        String.raw`    if ($os_major < 10) {`,
        String.raw`      warn "$0: only MacOSX is supported, not $OS $os_major.$os_minor "`,
        String.raw`           . " (from sw_vers -productVersion: $sw_vers)\n";`,
        String.raw`      return "unknown-unknown";`,
        String.raw`    }`,
        String.raw`    if ($os_major >= 11) { $CPU = "x86_64"; $OS = "darwin"; }`,
        String.raw`    elsif ($os_minor >= $mactex_darwin) {`,
        String.raw`      ; # current version, default is ok (x86_64-darwin).`,
        String.raw`    } elsif ($os_minor >= 6 && $os_minor < $mactex_darwin) {`,
      ].join('\n'),
    );
  });
});
