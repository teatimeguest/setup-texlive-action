import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as tl from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

jest.mock('os', () => ({
  tmpdir: jest.fn(),
}));
jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    join: jest.fn(),
    posix: actual.posix,
    win32: actual.win32,
  };
});
(os.tmpdir as jest.Mock).mockReturnValue(random());
jest.spyOn(fs, 'mkdtemp').mockResolvedValue(random());
jest.spyOn(fs, 'readFile').mockResolvedValue('');
jest.spyOn(fs, 'writeFile').mockImplementation();
jest.spyOn(core, 'addPath').mockImplementation();
jest.spyOn(exec, 'exec').mockImplementation();
jest.spyOn(glob, 'create');
jest.spyOn(tool, 'cacheDir').mockResolvedValue('');
jest.spyOn(tool, 'downloadTool').mockResolvedValue(random());
jest.spyOn(tool, 'extractTar').mockResolvedValue(random());
jest.spyOn(tool, 'extractZip').mockResolvedValue(random());
jest.spyOn(tool, 'find').mockReturnValue('');

beforeEach(() => {
  console.log('::stop-commands::stoptoken');
  process.env['GITHUB_PATH'] = '';

  (path.join as jest.Mock).mockImplementation(path.posix.join);
  (glob.create as jest.Mock).mockResolvedValue({
    glob: async (): Promise<Array<string>> => [],
  } as glob.Globber);
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  console.log('::stoptoken::');
}, 100000);

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
  const tlmgr = new tl.Manager('2019', '/usr/local/texlive');

  describe('install', () => {
    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install([]);
      expect(exec.exec).not.toBeCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = ['foo', 'bar', 'baz'];
      await tlmgr.install(packages);
      expect(exec.exec).toBeCalledWith('tlmgr', ['install', ...packages]);
    });
  });

  describe('pathAdd', () => {
    it('adds the bin directory to the PATH', async () => {
      (glob.create as jest.Mock).mockImplementation(async (pattern) => {
        return {
          glob: async () => [pattern.replace('*', 'x86_64-linux')],
        } as glob.Globber;
      });
      await tlmgr.pathAdd();
      expect(core.addPath).toBeCalledWith(
        '/usr/local/texlive/2019/bin/x86_64-linux',
      );
    });

    it.each([
      [[]],
      [['x86_64-linux', 'universal-darwin']],
      [['x86_64-linux', 'universal-darwin', 'Windows']],
    ])('fails as the bin directory cannot be located', async (matched) => {
      (glob.create as jest.Mock).mockImplementation(async (pattern) => {
        return {
          glob: async () => matched.map((x) => pattern.replace('*', x)),
        } as glob.Globber;
      });
      await expect(tlmgr.pathAdd()).rejects.toThrow(
        'Unable to locate the bin directory',
      );
    });
  });
});

describe('install', () => {
  beforeEach(() => {
    (glob.create as jest.Mock).mockImplementation(async (pattern) => {
      return {
        glob: async () => [pattern.replace('*', random())],
      } as glob.Globber;
    });
  });

  it('installs TeX Live 2008 on Linux', async () => {
    await tl.install('2008', '/usr/local/texlive', 'linux');
    expect(tool.find).toBeCalledWith('install-tl-unx.tar.gz', '2008');
    expect(tool.downloadTool).toBeCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl-unx.tar.gz',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl$/),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('/usr/local/texlive/2008/bin/'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs TeX Live 2008 on Windows', async () => {
    (path.join as jest.Mock).mockImplementation(path.win32.join);
    await tl.install('2008', 'C:\\texlive', 'win32');
    expect(tool.find).toBeCalledWith('install-tl.zip', '2008');
    expect(tool.downloadTool).toBeCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/install-tl.zip',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl.bat/),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/),
        '-location',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2008/tlnet/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('C:\\texlive\\2008\\bin\\'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs TeX Live 2013 on Windows', async () => {
    (path.join as jest.Mock).mockImplementation(path.win32.join);
    await tl.install('2013', 'C:\\texlive', 'win32');
    expect(tool.find).toBeCalledWith('install-tl.zip', '2013');
    expect(tool.downloadTool).toBeCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/install-tl.zip',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl-windows.bat/),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('C:\\texlive\\2013\\bin\\'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs TeX Live 2013 on macOS', async () => {
    await tl.install('2013', '/usr/local/texlive', 'darwin');
    expect(tool.find).toBeCalledWith('install-tl-unx.tar.gz', '2013');
    expect(tool.downloadTool).toBeCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/install-tl-unx.tar.gz',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl$/),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2013/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('/usr/local/texlive/2013/bin/'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs TeX Live 2016 on macOS', async () => {
    await tl.install('2016', '/usr/local/texlive', 'darwin');
    expect(tool.find).toBeCalledWith('install-tl-unx.tar.gz', '2016');
    expect(tool.downloadTool).toBeCalledWith(
      'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2016/tlnet-final/install-tl-unx.tar.gz',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl$/),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive\.profile$/),
        '-repository',
        'http://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2016/tlnet-final/',
      ],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('/usr/local/texlive/2016/bin/'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs the latest version of TeX Live on Linux', async () => {
    await tl.install('2021', '/usr/local/texlive', 'linux');
    expect(tool.find).toBeCalledWith('install-tl-unx.tar.gz', '2021');
    expect(tool.downloadTool).toBeCalledWith(
      'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
    );
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive\.profile$/),
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
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(/install-tl$/),
      ['-no-gui', '-profile', expect.stringMatching(/texlive\.profile$/)],
      expect.anything(),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining('/usr/local/texlive/2021/bin/'),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  it('installs TeX Live with a installer cache', async () => {
    (tool.find as jest.Mock).mockReturnValueOnce(random());
    await tl.install('2021', '/usr/local/texlive', 'linux');
    expect(tool.find).toBeCalledWith('install-tl-unx.tar.gz', '2021');
    expect(tool.downloadTool).not.toBeCalled();
    expect(tool.cacheDir).not.toBeCalled();
  });

  it('continues the installation even if `tool-cache` throws an exception', async () => {
    (tool.find as jest.Mock).mockImplementationOnce(() => {
      throw new Error('oops');
    });
    (tool.cacheDir as jest.Mock).mockImplementationOnce(() => {
      throw new Error('oops');
    });
    await expect(
      tl.install('2021', '/usr/local/texlive', 'linux'),
    ).resolves.not.toThrow();
  });

  it('fails as the installer cannot be located', async () => {
    (glob.create as jest.Mock).mockReturnValue({
      glob: async () => [] as Array<string>,
    } as glob.Globber);
    await expect(tl.install('2021', 'C:\\texlive', 'win32')).rejects.toThrow(
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
      await expect(
        tl.install(version, '/usr/local/texlive', platform),
      ).rejects.toThrow(
        /^Installation of TeX Live \d{4} on (?:\w+) is not supported$/,
      );
    },
  );

  test.todo('tests for `patch`');
});
