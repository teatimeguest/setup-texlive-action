import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tool from '@actions/tool-cache';

import { Environment, InstallTL } from '#/install-tl';
import * as tl from '#/texlive';
import * as util from '#/utility';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

const env = (() => {
  const {
    GITHUB_PATH,
    TEXLIVE_DOWNLOADER,
    TL_DOWNLOAD_PROGRAM,
    TL_DOWNLOAD_ARGS,
    TEXLIVE_INSTALL_ENV_NOCHECK,
    TEXLIVE_INSTALL_NO_CONTEXT_CACHE,
    TEXLIVE_INSTALL_NO_RESUME,
    TEXLIVE_INSTALL_NO_WELCOME,
    TEXLIVE_INSTALL_PAPER,
    TEXLIVE_INSTALL_TEXMFHOME,
    TEXLIVE_INSTALL_TEXMFCONFIG,
    TEXLIVE_INSTALL_TEXMFVAR,
    NOPERLDOC,
    ...rest
  }: Partial<Record<string, string>> = { ...process.env };
  return rest;
})();

jest.spyOn(fs, 'mkdtemp').mockResolvedValue(random());
jest.spyOn(fs, 'readFile').mockImplementation();
jest.spyOn(fs, 'writeFile').mockImplementation();
jest.mock('os', () => ({
  homedir: jest.fn(),
  platform: jest.fn(),
  tmpdir: jest.fn(),
}));
(os.homedir as jest.Mock).mockReturnValue(random());
(os.tmpdir as jest.Mock).mockReturnValue(random());
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
jest.spyOn(core, 'addPath').mockImplementation();
jest.spyOn(core, 'debug').mockImplementation();
jest.spyOn(core, 'info').mockImplementation();
jest.spyOn(exec, 'exec').mockImplementation();
jest.spyOn(tool, 'cacheDir').mockResolvedValue('');
jest.spyOn(tool, 'downloadTool').mockResolvedValue(random());
jest.spyOn(tool, 'extractTar').mockResolvedValue(random());
jest.spyOn(tool, 'extractZip').mockResolvedValue(random());
jest.spyOn(tool, 'find').mockReturnValue('');
jest.spyOn(util, 'expand').mockResolvedValue([random()]);
jest.spyOn(util, 'updateFile').mockImplementation();

beforeEach(() => {
  process.env = { ...env };
  process.env['RUNNER_TEMP'] = random();
});

describe('InstallTL', () => {
  describe('run', () => {
    it('installs TeX Live 2008', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2008', random());
      await installtl.run('/usr/local/texlive');
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        [
          '-no-gui',
          '-profile',
          expect.stringMatching(/texlive\.profile$/u),
          '-location',
          'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
        ],
        expect.objectContaining({
          env: expect.objectContaining({
            ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
            ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
            ['TEXLIVE_INSTALL_TEXMFHOME']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFCONFIG']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFVAR']: expect.anything(),
          }),
        }),
      );
    });

    it('installs TeX Live 2012', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2012', random());
      await installtl.run('/usr/local/texlive');
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        [
          '-no-gui',
          '-profile',
          expect.stringMatching(/texlive\.profile$/u),
          '-repository',
          'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2012/tlnet-final/',
        ],
        expect.objectContaining({
          env: expect.objectContaining({
            ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
            ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
            ['TEXLIVE_INSTALL_TEXMFHOME']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFCONFIG']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFVAR']: expect.anything(),
          }),
        }),
      );
    });

    it('installs TeX Live 2021', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2021', random());
      await installtl.run('/usr/local/texlive');
      expect(exec.exec).toHaveBeenCalledWith(
        expect.stringContaining(''),
        ['-no-gui', '-profile', expect.stringMatching(/texlive\.profile$/u)],
        expect.objectContaining({
          env: expect.objectContaining({
            ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
            ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
            ['TEXLIVE_INSTALL_TEXMFHOME']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFCONFIG']: expect.anything(),
            ['TEXLIVE_INSTALL_TEXMFVAR']: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('#profile', () => {
    it('creates profile for TeX Live 2008', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2008', random());
      await installtl.run('/usr/local/texlive');
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        expect.stringMatching(/setup-texlive-$/u),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/texlive\.profile$/u),
        expect.stringContaining(
          [
            'TEXMFLOCAL /usr/local/texlive/texmf-local',
            'TEXMFSYSCONFIG /usr/local/texlive/2008/texmf-config',
            'TEXMFSYSVAR /usr/local/texlive/2008/texmf-var',
            'selected_scheme scheme-minimal',
            'option_adjustrepo 0',
          ].join('\n'),
        ),
      );
    });

    it('creates profile for TeX Live 2016', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2016', random());
      await installtl.run('/usr/local/texlive');
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        expect.stringMatching(/setup-texlive-$/u),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/texlive\.profile$/u),
        expect.stringContaining(
          [
            'TEXMFLOCAL /usr/local/texlive/texmf-local',
            'TEXMFSYSCONFIG /usr/local/texlive/2016/texmf-config',
            'TEXMFSYSVAR /usr/local/texlive/2016/texmf-var',
            'selected_scheme scheme-infraonly',
            'option_adjustrepo 0',
          ].join('\n'),
        ),
      );
    });

    it('creates profile for TeX Live 2021', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2021', random());
      await installtl.run('/usr/local/texlive');
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        expect.stringMatching(/setup-texlive-$/u),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/texlive\.profile$/u),
        expect.stringContaining(
          [
            'TEXMFLOCAL /usr/local/texlive/texmf-local',
            'TEXMFSYSCONFIG /usr/local/texlive/2021/texmf-config',
            'TEXMFSYSVAR /usr/local/texlive/2021/texmf-var',
            'selected_scheme scheme-infraonly',
            'option_adjustrepo 1',
          ].join('\n'),
        ),
      );
    });

    it('uses `RUNNER_TEMP`', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const installtl = new InstallTL('2021', random());
      await installtl.run('/usr/local/texlive');
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        path.join(process.env['RUNNER_TEMP']!, 'setup-texlive-'),
      );
    });

    it('uses `os.tmpdir()` if `RUNNER_TEMP` is not set', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      process.env['RUNNER_TEMP'] = '';
      const installtl = new InstallTL('2021', random());
      await installtl.run('/usr/local/texlive');
      expect(fs.mkdtemp).toHaveBeenCalledWith(
        path.join(os.tmpdir(), 'setup-texlive-'),
      );
    });
  });

  describe('download', () => {
    it('downloads the installer on Linux', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      await InstallTL.download('2021');
      expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2021');
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.extractTar).toHaveBeenCalled();
      expect(tool.cacheDir).toHaveBeenCalled();
    });

    it('downloads the installer on Windows', async () => {
      (os.platform as jest.Mock).mockReturnValue('win32');
      await InstallTL.download('2021');
      expect(tool.find).toHaveBeenCalledWith('install-tl.zip', '2021');
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl.zip',
      );
      expect(tool.extractZip).toHaveBeenCalled();
      expect(tool.cacheDir).toHaveBeenCalled();
    });

    it('downloads the installer on macOS', async () => {
      (os.platform as jest.Mock).mockReturnValue('darwin');
      await InstallTL.download('2021');
      expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2021');
      expect(tool.downloadTool).toHaveBeenCalledWith(
        'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      );
      expect(tool.extractTar).toHaveBeenCalled();
      expect(tool.cacheDir).toHaveBeenCalled();
    });

    it.each<[tl.Version, NodeJS.Platform]>([
      ['2007', 'linux'],
      ['2007', 'win32'],
      ['2012', 'darwin'],
    ])('does not support TeX Live %s on %s', async (version, platform) => {
      (os.platform as jest.Mock).mockReturnValue(platform);
      await expect(InstallTL.download(version)).rejects.toThrow(
        /^Installation of TeX Live \d{4} on (?:\w+) is not supported$/u,
      );
    });

    it('uses cache instead of downloading', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      (tool.find as jest.Mock).mockReturnValueOnce(random());
      await InstallTL.download('2021');
      expect(tool.find).toHaveBeenCalled();
      expect(tool.downloadTool).not.toHaveBeenCalled();
    });

    it('does not fail even if restoring and saving cache fails', async () => {
      (os.platform as jest.Mock).mockReturnValue('linux');
      const fail = (): string => {
        throw new Error('oops');
      };
      (tool.find as jest.Mock).mockImplementationOnce(fail);
      (tool.cacheDir as jest.Mock).mockImplementationOnce(fail);
      await expect(InstallTL.download('2021')).resolves.not.toThrow();
    });

    it('fails as the installer cannot be located', async () => {
      (os.platform as jest.Mock).mockReturnValue('win32');
      (util.expand as jest.Mock).mockResolvedValueOnce([]);
      await expect(InstallTL.download('2021')).rejects.toThrow(
        'Unable to locate the installer',
      );
      (util.expand as jest.Mock).mockResolvedValueOnce([random(), random()]);
      await expect(InstallTL.download('2021')).rejects.toThrow(
        'Unable to locate the installer',
      );
    });
  });
});

describe('Environment.get', () => {
  it('returns the default values correctly', () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.homedir as jest.Mock).mockReturnValueOnce('~');
    expect({ ...Environment.get('2021') }).toStrictEqual({
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
      ['TEXLIVE_INSTALL_NO_WELCOME']: 'true',
      ['TEXLIVE_INSTALL_TEXMFHOME']: '~/texmf',
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
      ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
    });
  });

  it('reads the user-defined values correctly', () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (os.homedir as jest.Mock).mockReturnValueOnce('~');
    process.env['TEXLIVE_INSTALL_NO_CONTEXT_CACHE'] = 'true';
    process.env['TEXLIVE_INSTALL_NO_WELCOME'] = 'false';
    process.env['TEXLIVE_INSTALL_TEXMFHOME'] = '~/.texmf';
    expect({ ...Environment.get('2021') }).toStrictEqual({
      ['TEXLIVE_INSTALL_ENV_NOCHECK']: 'true',
      ['TEXLIVE_INSTALL_NO_CONTEXT_CACHE']: 'true',
      ['TEXLIVE_INSTALL_NO_WELCOME']: 'false',
      ['TEXLIVE_INSTALL_TEXMFHOME']: '~/.texmf',
      ['TEXLIVE_INSTALL_TEXMFCONFIG']: '~/.local/texlive/2021/texmf-config',
      ['TEXLIVE_INSTALL_TEXMFVAR']: '~/.local/texlive/2021/texmf-var',
    });
  });
});

describe('executable', () => {
  it('returns the filename for TeX Live 2021 on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    const installtl = await InstallTL.download('2021');
    await installtl.run('/usr/local/texlive');
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2012 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = await InstallTL.download('2012');
    await installtl.run('C:\\texlive');
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl\.bat$/u),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns the filename for TeX Live 2016 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = await InstallTL.download('2016');
    await installtl.run('C:\\texlive');
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
    await InstallTL.download('2021');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        '^https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
      ),
    );
  });

  it('returns the url for TeX Live 2008', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.download('2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl-unx.tar.gz$',
      ),
    );
  });

  it('returns the url for TeX Live 2010', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.download('2010');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2010/tlnet-final/install-tl-unx.tar.gz$',
      ),
    );
  });

  it('returns the url for TeX Live 2018', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await InstallTL.download('2018');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      expect.stringMatching(
        'https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2018/tlnet-final/install-tl-unx.tar.gz$',
      ),
    );
  });
});

describe('patch', () => {
  beforeEach(() => {
    (util.updateFile as jest.Mock).mockRestore();
  });

  afterEach(() => {
    jest.spyOn(util, 'updateFile').mockImplementation();
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
    const installtl = new InstallTL('2021', random());
    await installtl.run('C:\\texlive');
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
      return random();
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = new InstallTL('2021', random());
    await expect(installtl.run('C:\\texlive')).resolves.not.toThrow();
  });

  it('rethrows an error that is not of Node.js', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        throw error;
      }
      return random();
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = new InstallTL('2021', random());
    await expect(installtl.run('C:\\texlive')).rejects.toThrow('oops');
  });

  it('rethrows a Node.js error of which code is not `ENOENT`', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        (error as NodeJS.ErrnoException).code = 'ENOTDIR';
        throw error;
      }
      return random();
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    const installtl = new InstallTL('2021', random());
    await expect(installtl.run('C:\\texlive')).rejects.toThrow('oops');
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
    const installtl = new InstallTL('2010', random());
    await installtl.run('/usr/local/setup-texlive');
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
    const installtl = new InstallTL('2015', random());
    await installtl.run('C:\\texlive');
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
    const installtl = new InstallTL('2018', random());
    await installtl.run('C:\\texlive');
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
    const installtl = new InstallTL('2018', random());
    await installtl.run('/tmp/setup-texlive');
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
