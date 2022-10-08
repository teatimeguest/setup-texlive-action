import { readFile } from 'node:fs/promises';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import dedent from 'dedent';

import * as ctan from '#/ctan';
import { Version } from '#/texlive';
import { Tlmgr } from '#/tlmgr';
import * as util from '#/utility';

jest.unmock('#/tlmgr');

const v = (spec: unknown) => new Version(`${spec}`);

describe('Tlmgr', () => {
  describe('conf.texmf', () => {
    it('returns the value of the given key by using `kpsewhich`', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
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
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
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
  });

  describe('install', () => {
    const tlmgr = new Tlmgr(v`latest`, '');

    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install([]);
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = ['foo', 'bar', 'baz'];
      await tlmgr.install(packages);
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['install', ...packages],
        expect.anything(),
      );
    });

    it('tries to determine the TL name', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
        exitCode: 1,
        stdout: '',
        stderr: 'tlmgr install: package foo not present in repository.',
      });
      jest.mocked(ctan.pkg).mockResolvedValueOnce({ texlive: 'Foo' });
      await expect(tlmgr.install(['foo', 'bar', 'baz'])).toResolve();
      expect(exec.getExecOutput).toHaveBeenCalledWith('tlmgr', [
        'install',
        'Foo',
      ]);
    });
  });

  describe('list', () => {
    jest.mocked(readFile).mockResolvedValue(dedent`
      name 00texlive.config
      category Package
      depend minrelease/2016
      depend release/2022

      name texlive.infra
      category TLCore
      revision 63645
      shortdesc basic TeX Live infrastructure
      containersize 351180
      docfiles size=139
       README
      runfiles size=320
       LICENSE.CTAN

      name texlive.infra.universal-darwin
      category TLCore
      revision 62358
      shortdesc universal-darwin files of texlive.infra
      containersize 308304
      binfiles arch=universal-darwin size=246
       bin/universal-darwin/mktexlsr
       bin/universal-darwin/tlmgr
       tlpkg/installer/lz4/lz4.universal-darwin
       tlpkg/installer/xz/xz.universal-darwin

      name scheme-basic
      category Scheme
      revision 54191
      shortdesc basic scheme (plain and latex)
      relocated 1
      depend collection-basic
      depend collection-latex
      containersize 440

      name la\
      tex#comment
      category Package
      revision 61232
      shortdesc A TeX macro package that defines LaTeX
      depend latexconfig
      depend luatex
      depend pdftex
      containersize 221228
      catalogue-contact-home http://www.latex-project.org/
      catalogue-license lppl1.3c
      catalogue-topics format
      catalogue-version 2021-11-15 PL1

      name hyperref
      category Package
      revision 62142
      shortdesc Extensive support for hypertext in LaTeX
      catalogue-contact-bugs https://github.com/latex3/hyperref/issues
      catalogue-contact-home https://github.com/latex3/hyperref
      catalogue-ctan /macros/latex/contrib/hyperref
      catalogue-license lppl1.3
      catalogue-topics hyper pdf-feat adobe-distiller form-fillin etex
      catalogue-version 7.00n
    `);
    const tlmgr = new Tlmgr(v`latest`, '');
    const collect = async <T>(gen: AsyncGenerator<T>): Promise<Array<T>> => {
      const a = [];
      for await (const item of gen) {
        a.push(item);
      }
      return a;
    };

    it('strips comments and escaped line breaks', async () => {
      await expect(collect(tlmgr.list())).resolves.toContainEqual(
        expect.objectContaining({
          name: 'latex',
          version: '2021-11-15 PL1',
          revision: '61232',
        }),
      );
    });

    it('lists texlive.infra', async () => {
      await expect(collect(tlmgr.list())).resolves.toContainEqual(
        expect.objectContaining({
          name: 'texlive.infra',
          version: undefined,
          revision: '63645',
        }),
      );
    });

    it('does not list schemes and collections', async () => {
      await expect(collect(tlmgr.list())).resolves.not.toContainEqual(
        expect.objectContaining({ name: 'scheme-basic' }),
      );
    });

    it('does not list architecture-specific packages', async () => {
      await expect(collect(tlmgr.list())).resolves.not.toContainEqual(
        expect.objectContaining({ name: 'texlive.infra.universal-darwin' }),
      );
    });

    it('does not list texlive metadata', async () => {
      await expect(collect(tlmgr.list())).resolves.not.toContainEqual(
        expect.objectContaining({ name: '00texlive.config' }),
      );
    });

    it('lists normal packages', async () => {
      await expect(collect(tlmgr.list())).resolves.toContainEqual(
        expect.objectContaining({
          name: 'hyperref',
          version: '7.00n',
          revision: '62142',
        }),
      );
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
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        '<repository>',
        '*',
      ]);
    });

    it('pins a repository with globs', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await tlmgr.pinning.add('<repository>', '<glob1>', '<glob2>');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
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
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', '<tag>'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with the empty tag', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>', '')).toResolve();
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', ''],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with no tags', async () => {
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>')).toResolve();
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('can safely add the repository again', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
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
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
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
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('updates tlmgr itself', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['update', '--self']);
    });

    it('updates tlmgr itself by updating texlive.infra', async () => {
      const tlmgr = new Tlmgr(v`2008`, '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'texlive.infra',
      ]);
    });

    it('updates all packages', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(tlmgr.update(undefined, { all: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['update', '--all']);
    });

    it('updates packages with `--reinstall-forcibly-removed`', async () => {
      const tlmgr = new Tlmgr(v`latest`, '');
      await expect(
        tlmgr.update(['foo', 'bar', 'baz'], { reinstallForciblyRemoved: true }),
      )
        .toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        '--reinstall-forcibly-removed',
        'foo',
        'bar',
        'baz',
      ]);
    });
  });
});
