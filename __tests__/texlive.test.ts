import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

process.env['GITHUB_PATH'] = undefined;

jest.mock('os', () => ({
  platform: jest.fn(),
  tmpdir: jest.fn(),
}));
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
jest.spyOn(fs, 'mkdtemp').mockResolvedValue(random());
jest.spyOn(fs, 'readFile').mockResolvedValue(random());
jest.spyOn(fs, 'writeFile').mockImplementation();
jest.spyOn(core, 'addPath').mockImplementation();
jest.spyOn(core, 'debug').mockImplementation();
jest
  .spyOn(core, 'group')
  .mockImplementation(
    async <T>(name: string, fn: () => Promise<T>): Promise<T> => await fn(),
  );
jest.spyOn(core, 'info').mockImplementation();
jest.spyOn(exec, 'exec').mockImplementation();
jest
  .spyOn(exec, 'getExecOutput')
  .mockResolvedValue({ exitCode: 0, stdout: random(), stderr: random() });
jest.spyOn(glob, 'create').mockImplementation(async (pattern) => {
  return {
    glob: async () => [pattern.replace(/\*/u, random())],
  } as glob.Globber;
});
jest.spyOn(tool, 'cacheDir').mockResolvedValue('');
jest.spyOn(tool, 'downloadTool').mockResolvedValue(random());
jest.spyOn(tool, 'extractTar').mockResolvedValue(random());
jest.spyOn(tool, 'extractZip').mockResolvedValue(random());
jest.spyOn(tool, 'find').mockReturnValue('');

test.each([
  ['1995', false],
  ['1996', true],
  ['2008', true],
  ['2015', true],
  ['2021', true],
  ['2022', false],
  ['latest', false],
])('isVersion(%o)', (version, result) => {
  expect(tl.isVersion(version)).toBe(result);
});

describe('Manager', () => {
  describe('install', () => {
    const tlmgr = new tl.Manager('2019', '/usr/local/texlive');

    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install([]);
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = ['foo', 'bar', 'baz'];
      await tlmgr.install(packages);
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['install', ...packages]);
    });
  });

  describe('path.add', () => {
    const tlmgr = new tl.Manager('2019', '/usr/local/texlive');

    it('adds the bin directory to the PATH', async () => {
      (glob.create as jest.Mock).mockImplementationOnce(async (pattern) => {
        return {
          glob: async () => [pattern.replace('*', 'x86_64-linux')],
        } as glob.Globber;
      });
      await tlmgr.path.add();
      expect(core.addPath).toHaveBeenCalledWith(
        '/usr/local/texlive/2019/bin/x86_64-linux',
      );
    });

    it.each([
      [[]],
      [['x86_64-linux', 'universal-darwin']],
      [['x86_64-linux', 'universal-darwin', 'Windows']],
    ])('fails as the bin directory cannot be located', async (matched) => {
      (glob.create as jest.Mock).mockImplementationOnce(async (pattern) => {
        return {
          glob: async () => matched.map((x) => pattern.replace('*', x)),
        } as glob.Globber;
      });
      await expect(tlmgr.path.add()).rejects.toThrow(
        'Unable to locate the bin directory',
      );
    });
  });

  describe('pinning.add', () => {
    it('pins a repository with a glob', async () => {
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await tlmgr.pinning.add(random(), '*');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        expect.anything(),
        '*',
      ]);
    });

    it('pins a repository with globs', async () => {
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await tlmgr.pinning.add(random(), 'ams*', 'tikz*');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        expect.anything(),
        'ams*',
        'tikz*',
      ]);
    });

    it('fails since the `pinning` action is not implemented', async () => {
      const tlmgr = new tl.Manager('2012', '/usr/local/texlive');
      await expect(async () => {
        await tlmgr.pinning.add(random(), random());
      }).rejects.toThrow(
        '`pinning` action is not implemented in TeX Live 2012',
      );
    });
  });

  describe('repository.add', () => {
    it('adds a repository with a tag', async () => {
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await tlmgr.repository.add(random(), 'tag');
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', expect.anything(), 'tag'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with no tags', async () => {
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await tlmgr.repository.add(random());
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', expect.anything()],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('can safely add the repository again', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValueOnce({
        exitCode: 2,
        stdout: '',
        stderr: [
          `tlmgr: repository or its tag already defined, no action: ${random()}`,
          'tlmgr: An error has occurred. See above messages. Exiting.',
        ].join('\n'),
      });
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await expect(
        tlmgr.repository.add(random(), random()),
      ).resolves.not.toThrow();
    });

    it('fails with non-zero status code', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValueOnce({
        exitCode: 2,
        stdout: '',
        stderr: [
          `tlmgr: neither https?/ftp/ssh/scp/file URI nor absolute path, no action: ${random()}`,
          `tlmgr: An error has occurred. See above messages. Exiting.`,
        ].join('\n'),
      });
      const tlmgr = new tl.Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random(), random())).rejects.toThrow(
        /^`tlmgr` failed with exit code 2: /u,
      );
    });

    it('fails since the `repository` action is not implemented', async () => {
      const tlmgr = new tl.Manager('2011', '/usr/local/texlive');
      await expect(async () => {
        await tlmgr.repository.add(random(), random());
      }).rejects.toThrow(
        '`repository` action is not implemented in TeX Live 2011',
      );
    });
  });
});

describe('install', () => {
  it('installs TeX Live 2008 on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await tl.install('2008', '/usr/local/texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl-unx.tar.gz',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
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
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('/usr/local/texlive/2008/bin/'),
    );
  });

  it('installs TeX Live 2008 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    await tl.install('2008', 'C:\\texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl.zip', '2008');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl.zip',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/texlive\.profile$/u),
      expect.stringContaining(
        [
          'TEXMFLOCAL C:\\texlive\\texmf-local',
          'TEXMFSYSCONFIG C:\\texlive\\2008\\texmf-config',
          'TEXMFSYSVAR C:\\texlive\\2008\\texmf-var',
          'selected_scheme scheme-minimal',
          'option_adjustrepo 0',
        ].join('\n'),
      ),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl\.bat$/u),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('C:\\texlive\\2008\\bin\\'),
    );
  });

  it('installs TeX Live 2013 on Windows', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    await tl.install('2013', 'C:\\texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl.zip', '2013');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/install-tl.zip',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/texlive\.profile$/u),
      expect.stringContaining(
        [
          'TEXMFLOCAL C:\\texlive\\texmf-local',
          'TEXMFSYSCONFIG C:\\texlive\\2013\\texmf-config',
          'TEXMFSYSVAR C:\\texlive\\2013\\texmf-var',
          'selected_scheme scheme-minimal',
          'option_adjustrepo 0',
        ].join('\n'),
      ),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl-windows\.bat$/u),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('C:\\texlive\\2013\\bin\\'),
    );
  });

  it('installs TeX Live 2013 on macOS', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await tl.install('2013', '/usr/local/texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2013');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/install-tl-unx.tar.gz',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/texlive\.profile$/u),
      expect.stringContaining(
        [
          'TEXMFLOCAL /usr/local/texlive/texmf-local',
          'TEXMFSYSCONFIG /usr/local/texlive/2013/texmf-config',
          'TEXMFSYSVAR /usr/local/texlive/2013/texmf-var',
          'selected_scheme scheme-minimal',
          'option_adjustrepo 0',
        ].join('\n'),
      ),
    );
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('/usr/local/texlive/2013/bin/'),
    );
  });

  it('installs TeX Live 2016 on macOS', async () => {
    (os.platform as jest.Mock).mockReturnValue('darwin');
    await tl.install('2016', '/usr/local/texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2016');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2016/tlnet-final/install-tl-unx.tar.gz',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
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
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/u),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2016/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('/usr/local/texlive/2016/bin/'),
    );
  });

  it('installs the latest version of TeX Live on Linux', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    await tl.install('2021', '/usr/local/texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2021');
    expect(tool.downloadTool).toHaveBeenCalledWith(
      'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
    );
    expect(tool.cacheDir).toHaveBeenCalled();
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
    expect(exec.exec).toHaveBeenCalledWith(
      expect.stringMatching(/install-tl$/u),
      ['-no-gui', '-profile', expect.stringMatching(/texlive\.profile$/u)],
      expect.anything(),
    );
    expect(core.addPath).toHaveBeenCalledWith(
      expect.stringContaining('/usr/local/texlive/2021/bin/'),
    );
  });

  it('installs TeX Live with a installer cache', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (tool.find as jest.Mock).mockReturnValueOnce(random());
    await tl.install('2021', '/usr/local/texlive');
    expect(tool.find).toHaveBeenCalledWith('install-tl-unx.tar.gz', '2021');
    expect(tool.downloadTool).not.toHaveBeenCalled();
    expect(tool.cacheDir).not.toHaveBeenCalled();
  });

  it('continues the installation even if `tool-cache` throws an exception', async () => {
    (os.platform as jest.Mock).mockReturnValue('linux');
    (tool.find as jest.Mock).mockImplementationOnce(() => {
      throw new Error('oops');
    });
    (tool.cacheDir as jest.Mock).mockImplementationOnce(() => {
      throw new Error('oops');
    });
    await expect(
      tl.install('2021', '/usr/local/texlive'),
    ).resolves.not.toThrow();
  });

  it('fails as the installer cannot be located', async () => {
    (os.platform as jest.Mock).mockReturnValue('win32');
    (glob.create as jest.Mock).mockReturnValueOnce({
      glob: async () => [] as Array<string>,
    } as glob.Globber);
    await expect(tl.install('2021', 'C:\\texlive')).rejects.toThrow(
      'Unable to locate the installer path',
    );
  });

  it.each<[tl.Version, NodeJS.Platform]>([
    ['2007', 'linux'],
    ['2007', 'win32'],
    ['2012', 'darwin'],
  ])(
    'does not support the installation of TeX Live %s on %s',
    async (version, platform) => {
      (os.platform as jest.Mock).mockReturnValue(platform);
      await expect(tl.install(version, random())).rejects.toThrow(
        /^Installation of TeX Live \d{4} on (?:\w+) is not supported$/u,
      );
    },
  );
});

describe('patch', () => {
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
    await tl.install('2021', 'C:\\TEMP\\setup-texlive');
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
    await expect(
      tl.install('2021', 'C:\\TEMP\\setup-texlive'),
    ).resolves.not.toThrow();
  });

  it('rethrows the exception of which code is not `ENOENT`', async () => {
    (fs.readFile as jest.Mock).mockImplementation(async (filename: string) => {
      if (/install-tl(?:-windows)?\.bat$/u.test(filename)) {
        const error = new Error('oops');
        throw error;
      }
      return random();
    });
    (os.platform as jest.Mock).mockReturnValue('win32');
    await expect(tl.install('2021', 'C:\\TEMP\\setup-texlive')).rejects.toThrow(
      'oops',
    );
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
    await tl.install('2010', '/tmp/setup-texlive');
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
    await tl.install('2015', 'C:\\TEMP\\setup-texlive');
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
    await tl.install('2018', 'C:\\TEMP\\setup-texlive');
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
    await tl.install('2018', '/tmp/setup-texlive');
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
