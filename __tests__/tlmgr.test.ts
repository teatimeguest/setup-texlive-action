import * as core from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
import dedent from 'dedent';

import * as ctan from '#/ctan';
import { Version } from '#/texlive';
import { Tlmgr } from '#/tlmgr';
import * as tlpkg from '#/tlpkg';
import * as util from '#/utility';

jest.unmock('#/tlmgr');

const v = (spec: unknown) => new Version(`${spec}`);

describe('Tlmgr', () => {
  describe('conf.texmf', () => {
    it('returns the value of the given key by using `kpsewhich`', async () => {
      jest.mocked(getExecOutput).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '/usr/local/texlive/2021/texmf-config\n',
        stderr: '',
      });
      const tlmgr = new Tlmgr(v`2021`, '');
      await expect(tlmgr.conf.texmf('TEXMFCONFIG')).resolves.toBe(
        '/usr/local/texlive/2021/texmf-config',
      );
    });

    it('sets the value to the given key with `tlmgr`', async () => {
      const tlmgr = new Tlmgr(v`2021`, '');
      await tlmgr.conf.texmf('TEXMFVAR', '~/.local/texlive/2021/texmf-var');
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'conf',
        'texmf',
        'TEXMFVAR',
        '~/.local/texlive/2021/texmf-var',
      ]);
    });

    it('sets the value to the given key by environment variable', async () => {
      const tlmgr = new Tlmgr(v`2008`, '/usr/local/texlive/2008');
      await tlmgr.conf.texmf('TEXMFHOME', '~/.texmf');
      expect(core.exportVariable).toHaveBeenCalledWith('TEXMFHOME', '~/.texmf');
    });

    it('initializes TEXMFLOCAL if it is changed', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await tlmgr.conf.texmf('TEXMFLOCAL', '<TEXMFLOCAL>');
      expect(exec).toHaveBeenCalledWith('tlmgr', expect.anything());
      expect(tlpkg.makeLocalSkeleton).toHaveBeenCalledWith(
        '<TEXMFLOCAL>',
        expect.anything(),
      );
      expect(exec).toHaveBeenCalledWith('mktexlsr', ['<TEXMFLOCAL>']);
    });
  });

  describe('install', () => {
    const tlmgr = new Tlmgr(v`latest`, '');

    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install([]);
      expect(exec).not.toHaveBeenCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = ['foo', 'bar', 'baz'];
      await tlmgr.install(packages);
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['install', ...packages],
        expect.anything(),
      );
    });

    it('tries to determine the TL name', async () => {
      jest.mocked(getExecOutput).mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'tlmgr install: package foo not present in repository.',
      });
      jest.mocked(ctan.pkg).mockResolvedValueOnce({ texlive: 'Foo' });
      await expect(tlmgr.install(['foo', 'bar', 'baz'])).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith('tlmgr', [
        'install',
        'Foo',
      ]);
    });
  });

  describe('path.add', () => {
    const tlmgr = new Tlmgr(v`2019`, '/usr/local/texlive/2019');

    it('adds the bin directory to the PATH', async () => {
      jest.mocked(util.determine).mockResolvedValueOnce('<path>');
      await tlmgr.path.add();
      expect(util.determine).toHaveBeenCalledWith(
        '/usr/local/texlive/2019/bin/*',
      );
      expect(core.addPath).toHaveBeenCalledWith('<path>');
    });

    it('fails as the bin directory cannot be located', async () => {
      jest.mocked(util.determine).mockImplementationOnce(() => {
        throw new Error();
      });
      await expect(tlmgr.path.add()).rejects.toThrow(
        "Unable to locate TeX Live's binary directory",
      );
    });
  });

  describe('pinning.add', () => {
    it('pins a repository with a glob', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await tlmgr.pinning.add('<repository>', '*');
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        '<repository>',
        '*',
      ]);
    });

    it('pins a repository with globs', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await tlmgr.pinning.add('<repository>', '<glob1>', '<glob2>');
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        '<repository>',
        '<glob1>',
        '<glob2>',
      ]);
    });

    it('fails since the `pinning` action is not implemented', async () => {
      const tlmgr = new Tlmgr(v`2012`, '');
      await expect(async () => {
        await tlmgr.pinning.add('<repository>', '*');
      })
        .rejects
        .toThrow(
          '`pinning` action is not implemented in TeX Live 2012',
        );
    });
  });

  describe('repository.add', () => {
    it('adds a repository with a tag', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>', '<tag>')).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', '<tag>'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with the empty tag', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>', '')).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', ''],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with no tags', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>')).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('can safely add the repository again', async () => {
      jest.mocked(getExecOutput).mockResolvedValueOnce({
        exitCode: 2,
        stdout: '',
        stderr: dedent`
          tlmgr: repository or its tag already defined, no action: <repository>
          tlmgr: An error has occurred. See above messages. Exiting.
        `,
      });
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>', '<tag>')).toResolve();
    });

    it('fails with non-zero status code', async () => {
      jest.mocked(getExecOutput).mockResolvedValueOnce({
        exitCode: 2,
        stdout: '',
        stderr: dedent`
          tlmgr: neither https?/ftp/ssh/scp/file URI nor absolute path, no action: <repository>
          tlmgr: An error has occurred. See above messages. Exiting.
        `,
      });
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(
        tlmgr.repository.add('<repository>', '<tag>'),
      )
        .rejects
        .toThrow('tlmgr exited with 2');
    });

    it('fails since the `repository` action is not implemented', async () => {
      const tlmgr = new Tlmgr(v`2011`, '');
      await expect(async () => {
        await tlmgr.repository.add('<repository>', '<tag>');
      })
        .rejects
        .toThrow('`repository` action is not implemented in TeX Live 2011');
    });
  });

  describe('update', () => {
    it('updates packages', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(tlmgr.update(['foo', 'bar', 'baz'])).toResolve();
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('updates tlmgr itself', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec).toHaveBeenCalledWith('tlmgr', ['update', '--self']);
    });

    it('updates tlmgr itself by updating texlive.infra', async () => {
      const tlmgr = new Tlmgr(v`2008`, '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'texlive.infra',
      ]);
    });

    it('updates all packages', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(tlmgr.update(undefined, { all: true })).toResolve();
      expect(exec).toHaveBeenCalledWith('tlmgr', ['update', '--all']);
    });

    it('updates packages with `--reinstall-forcibly-removed`', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(
        tlmgr.update(['foo', 'bar', 'baz'], { reinstallForciblyRemoved: true }),
      )
        .toResolve();
      expect(exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        '--reinstall-forcibly-removed',
        'foo',
        'bar',
        'baz',
      ]);
    });
  });
});
