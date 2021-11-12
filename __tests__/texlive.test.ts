import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';
import * as tool from '@actions/tool-cache';

import * as tl from '#/texlive';

jest.spyOn(fs, 'mkdtemp');
jest.spyOn(fs, 'writeFile');
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
jest.spyOn(core, 'addPath');
jest.spyOn(exec, 'exec');
jest.spyOn(glob, 'create');
jest.spyOn(tool, 'cacheDir');
jest.spyOn(tool, 'downloadTool');
jest.spyOn(tool, 'find');
jest.spyOn(tool, 'extractTar');
jest.spyOn(tool, 'extractZip');

const random = (): string => (Math.random() + 1).toString(32).substring(7);

beforeEach(() => {
  console.log('::stop-commands::stoptoken');
  process.env['GITHUB_PATH'] = '';

  (fs.mkdtemp as jest.Mock).mockResolvedValue(random());
  (fs.writeFile as jest.Mock).mockImplementation();
  (os.tmpdir as jest.Mock).mockReturnValue(random());
  (path.join as jest.Mock).mockImplementation(path.posix.join);
  (core.addPath as jest.Mock).mockImplementation();
  (exec.exec as jest.Mock).mockImplementation();
  (glob.create as jest.Mock).mockResolvedValue({
    glob: async (): Promise<Array<string>> => [],
  } as glob.Globber);
  (tool.cacheDir as jest.Mock).mockResolvedValue('');
  (tool.downloadTool as jest.Mock).mockResolvedValue(random());
  (tool.extractTar as jest.Mock).mockResolvedValue(random());
  (tool.extractZip as jest.Mock).mockResolvedValue(random());
  (tool.find as jest.Mock).mockReturnValue('');
});

afterEach(() => {
  jest.resetAllMocks();
  jest.clearAllMocks();
});

afterAll(async () => {
  console.log('::stoptoken::');
}, 100000);

test.each([
  ['2018', false],
  ['2019', true],
  ['2021', true],
  ['latest', false],
])('isVersion(%o)', (version, result) => {
  expect(tl.isVersion(version)).toBe(result);
});

describe('Manager', () => {
  test.each<[tl.Version, string, NodeJS.Platform, tl.Texmf]>([
    [
      '2019',
      '/usr/local/texlive',
      'linux',
      {
        texdir: '/usr/local/texlive/2019',
        local: '/usr/local/texlive/texmf-local',
        sysconfig: '/usr/local/texlive/2019/texmf-config',
        sysvar: '/usr/local/texlive/2019/texmf-var',
      },
    ],
    [
      '2019',
      'C:\\texlive',
      'win32',
      {
        texdir: 'C:\\texlive\\2019',
        local: 'C:\\texlive\\texmf-local',
        sysconfig: 'C:\\texlive\\2019\\texmf-config',
        sysvar: 'C:\\texlive\\2019\\texmf-var',
      },
    ],
  ])('conf() on $platform', (version, prefix, platform, texmf) => {
    (path.join as jest.Mock).mockImplementation(
      platform === 'win32' ? path.win32.join : path.posix.join,
    );
    const tlmgr = new tl.Manager(version, prefix);
    expect(tlmgr.conf()).toStrictEqual(texmf);
  });

  describe('install(packages)', () => {
    const tlmgr = new tl.Manager('2019', '/usr/local/texlive');

    test('with []', async () => {
      await tlmgr.install([]);
      expect(exec.exec).not.toBeCalled();
    });

    test("with ['foo', 'bar', 'baz']", async () => {
      await tlmgr.install(['foo', 'bar', 'baz']);
      expect(exec.exec).toBeCalledWith('tlmgr', [
        'install',
        'foo',
        'bar',
        'baz',
      ]);
    });
  });

  describe('pathAdd()', () => {
    const tlmgr = new tl.Manager('2019', '/usr/local/texlive');

    it('succeeds', async () => {
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
    ])('fails as directory cannot be located', async (matched) => {
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

describe.each<
  [
    tl.Version,
    string,
    NodeJS.Platform,
    { profile: string; texdir: string; tool: string },
  ]
>([
  [
    '2019',
    '/usr/local/texlive',
    'linux',
    {
      profile: `TEXDIR /usr/local/texlive/2019
TEXMFLOCAL /usr/local/texlive/texmf-local
TEXMFSYSCONFIG /usr/local/texlive/2019/texmf-config
TEXMFSYSVAR /usr/local/texlive/2019/texmf-var
selected_scheme scheme-infraonly
instopt_adjustrepo 0
tlpdbopt_autobackup 0
tlpdbopt_desktop_integration 0
tlpdbopt_file_assocs 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_w32_multi_user 0`,
      texdir: '/usr/local/texlive/2019',
      tool: 'https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2019/tlnet-final/install-tl-unx.tar.gz',
    },
  ],
  [
    '2021',
    '/usr/local/texlive',
    'linux',
    {
      profile: `TEXDIR /usr/local/texlive/2021
TEXMFLOCAL /usr/local/texlive/texmf-local
TEXMFSYSCONFIG /usr/local/texlive/2021/texmf-config
TEXMFSYSVAR /usr/local/texlive/2021/texmf-var
selected_scheme scheme-infraonly
instopt_adjustrepo 1
tlpdbopt_autobackup 0
tlpdbopt_desktop_integration 0
tlpdbopt_file_assocs 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_w32_multi_user 0`,
      texdir: '/usr/local/texlive/2021',
      tool: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz',
    },
  ],
  [
    '2019',
    'C:\\texlive',
    'win32',
    {
      profile: `TEXDIR C:\\texlive\\2019
TEXMFLOCAL C:\\texlive\\texmf-local
TEXMFSYSCONFIG C:\\texlive\\2019\\texmf-config
TEXMFSYSVAR C:\\texlive\\2019\\texmf-var
selected_scheme scheme-infraonly
instopt_adjustrepo 0
tlpdbopt_autobackup 0
tlpdbopt_desktop_integration 0
tlpdbopt_file_assocs 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_w32_multi_user 0`,
      texdir: 'C:\\texlive\\2019',
      tool: 'https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2019/tlnet-final/install-tl.zip',
    },
  ],
  [
    '2021',
    'C:\\texlive',
    'win32',
    {
      profile: `TEXDIR C:\\texlive\\2021
TEXMFLOCAL C:\\texlive\\texmf-local
TEXMFSYSCONFIG C:\\texlive\\2021\\texmf-config
TEXMFSYSVAR C:\\texlive\\2021\\texmf-var
selected_scheme scheme-infraonly
instopt_adjustrepo 1
tlpdbopt_autobackup 0
tlpdbopt_desktop_integration 0
tlpdbopt_file_assocs 0
tlpdbopt_install_docfiles 0
tlpdbopt_install_srcfiles 0
tlpdbopt_w32_multi_user 0`,
      texdir: 'C:\\texlive\\2021',
      tool: 'https://mirror.ctan.org/systems/texlive/tlnet/install-tl.zip',
    },
  ],
])('install(%o, %o, %o)', (version, prefix, platform, data) => {
  beforeEach(() => {
    (path.join as jest.Mock).mockImplementation(
      platform === 'win32' ? path.win32.join : path.posix.join,
    );
  });

  test('by downloading', async () => {
    (glob.create as jest.Mock).mockImplementation(async (pattern) => {
      return {
        glob: async () => [pattern.replace('*', 'matched')],
      } as glob.Globber;
    });

    await tl.install(version, prefix, platform);

    expect(tool.find).toBeCalledWith(path.posix.basename(data.tool), version);
    expect(tool.downloadTool).toBeCalledWith(data.tool);
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive.profile$/),
      data.profile,
    );
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(
        platform === 'win32' ? /install-tl-windows$/ : /install-tl$/,
      ),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive.profile$/),
        ...(version === tl.LATEST_VERSION
          ? []
          : [
              '-repository',
              expect.stringMatching(path.posix.dirname(data.tool)),
            ]),
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          TEXLIVE_INSTALL_ENV_NOCHECK: expect.anything(),
        }),
      }),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining(path.join(data.texdir, 'bin')),
    );
    expect(tool.cacheDir).toBeCalled();
  });

  test('with cache', async () => {
    (glob.create as jest.Mock).mockImplementation(async (pattern) => {
      return {
        glob: async () => [pattern.replace('*', 'matched')],
      } as glob.Globber;
    });
    (tool.find as jest.Mock).mockReturnValue(random());

    await tl.install(version, prefix, platform);

    expect(tool.find).toBeCalledWith(path.posix.basename(data.tool), version);
    expect(tool.downloadTool).not.toBeCalled();
    expect(fs.writeFile).toBeCalledWith(
      expect.stringMatching(/texlive.profile$/),
      data.profile,
    );
    expect(exec.exec).toBeCalledWith(
      expect.stringMatching(
        platform === 'win32' ? /install-tl-windows$/ : /install-tl$/,
      ),
      [
        '-no-gui',
        '-profile',
        expect.stringMatching(/texlive.profile$/),
        ...(version === tl.LATEST_VERSION
          ? []
          : [
              '-repository',
              expect.stringMatching(path.posix.dirname(data.tool)),
            ]),
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          TEXLIVE_INSTALL_ENV_NOCHECK: expect.anything(),
        }),
      }),
    );
    expect(core.addPath).toBeCalledWith(
      expect.stringContaining(path.join(data.texdir, 'bin')),
    );
    expect(tool.cacheDir).not.toBeCalled();
  });

  if (platform === 'win32') {
    it('fails as installer cannot be located', async () => {
      await expect(tl.install(version, prefix, platform)).rejects.toThrow(
        'Unable to locate the installer path',
      );
    });
  }
});
