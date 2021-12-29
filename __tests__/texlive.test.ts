import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as glob from '@actions/glob';

import { Manager, Version } from '#/texlive';

const random = (): string => (Math.random() + 1).toString(32).substring(7);

process.env['GITHUB_PATH'] = '';

jest.spyOn(core, 'addPath').mockImplementation();
jest.spyOn(core, 'debug').mockImplementation();
jest.spyOn(core, 'exportVariable').mockImplementation();
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

describe('Version', () => {
  test.each([
    ['1995', false],
    ['1996', true],
    ['2008', true],
    ['2015', true],
    ['2021', true],
    ['2022', false],
    ['latest', false],
  ])('isVersion(%o)', (version, result) => {
    expect(Version.isVersion(version)).toBe(result);
  });
});

describe('Manager', () => {
  describe('conf.texmf', () => {
    it('returns all values of TEXMF', async () => {
      const mock = async (
        cmd: string,
        args: ReadonlyArray<string>,
      ): Promise<exec.ExecOutput> => {
        if (
          cmd === 'kpsewhich' &&
          args.length === 2 &&
          args[0] === '-var-value' &&
          args[1] !== undefined
        ) {
          return { exitCode: 0, stdout: args[1], stderr: '' };
        }
        throw new Error(`Unexpected arguments: ${cmd}; ${args}`);
      };
      (exec.getExecOutput as jest.Mock)
        .mockImplementationOnce(mock)
        .mockImplementationOnce(mock)
        .mockImplementationOnce(mock);
      const tlmgr = new Manager('2021', '/usr/local/texlive');
      expect(Object.fromEntries(await tlmgr.conf.texmf())).toStrictEqual({
        ['TEXMFHOME']: 'TEXMFHOME',
        ['TEXMFCONFIG']: 'TEXMFCONFIG',
        ['TEXMFVAR']: 'TEXMFVAR',
      });
    });

    it('returns the value of the given key by using `kpsewhich`', async () => {
      (exec.getExecOutput as jest.Mock).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '/usr/local/texlive/2021/texmf-config\n',
        stderr: '',
      });
      const tlmgr = new Manager('2021', '/usr/local/texlive');
      await expect(tlmgr.conf.texmf('TEXMFCONFIG')).resolves.toBe(
        '/usr/local/texlive/2021/texmf-config',
      );
    });

    it('sets the value to the given key with `tlmgr`', async () => {
      const tlmgr = new Manager('2021', '/usr/local/texlive');
      await tlmgr.conf.texmf('TEXMFVAR', '~/.local/texlive/2021/texmf-var');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'conf',
        'texmf',
        'TEXMFVAR',
        '~/.local/texlive/2021/texmf-var',
      ]);
    });

    it('sets the value to the given key by environment variable', async () => {
      const tlmgr = new Manager('2008', '/usr/local/texlive');
      await tlmgr.conf.texmf('TEXMFHOME', '~/.texmf');
      expect(core.exportVariable).toHaveBeenCalledWith('TEXMFHOME', '~/.texmf');
    });
  });

  describe('install', () => {
    const tlmgr = new Manager('2019', '/usr/local/texlive');

    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install(new Set([]));
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = new Set(['foo', 'bar', 'baz']);
      await tlmgr.install(packages);
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['install', ...packages]);
    });
  });

  describe('path.add', () => {
    const tlmgr = new Manager('2019', '/usr/local/texlive');

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
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await tlmgr.pinning.add(random(), '*');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        expect.anything(),
        '*',
      ]);
    });

    it('pins a repository with globs', async () => {
      const tlmgr = new Manager('2019', '/usr/local/texlive');
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
      const tlmgr = new Manager('2012', '/usr/local/texlive');
      await expect(async () => {
        await tlmgr.pinning.add(random(), random());
      }).rejects.toThrow(
        '`pinning` action is not implemented in TeX Live 2012',
      );
    });
  });

  describe('repository.add', () => {
    it('adds a repository with a tag', async () => {
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random(), 'tag')).resolves.toBe(true);
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', expect.anything(), 'tag'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with the empty tag', async () => {
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random(), '')).resolves.toBe(true);
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', expect.anything(), ''],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with no tags', async () => {
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random())).resolves.toBe(true);
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
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random(), random())).resolves.toBe(
        false,
      );
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
      const tlmgr = new Manager('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add(random(), random())).rejects.toThrow(
        /^`tlmgr` failed with exit code 2: /u,
      );
    });

    it('fails since the `repository` action is not implemented', async () => {
      const tlmgr = new Manager('2011', '/usr/local/texlive');
      await expect(async () => {
        await tlmgr.repository.add(random(), random());
      }).rejects.toThrow(
        '`repository` action is not implemented in TeX Live 2011',
      );
    });
  });
});
