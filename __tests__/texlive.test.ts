import { platform } from 'node:os';

import * as core from '@actions/core';
import * as exec from '@actions/exec';

import * as ctan from '#/ctan';
import * as log from '#/log';
import { DependsTxt, Tlmgr, Version } from '#/texlive';
import * as util from '#/utility';

const v = (spec: unknown) => new Version(`${spec}`);

jest.unmock('#/texlive');

describe('Version', () => {
  describe('constructor', () => {
    it.each(['2008', '2013', '2021', 'latest'])('accepts %p', (spec) => {
      expect(() => new Version(spec)).not.toThrow();
    });

    it.each(['2007', '2099', '', 'version'])('rejects %p', (spec) => {
      expect(() => new Version(spec)).toThrow('');
    });

    it.each(['2008', '2010', '2012'])('rejects %p on macOS', (spec) => {
      jest.mocked(platform).mockReturnValueOnce('darwin');
      expect(() => new Version(spec)).toThrow('does not work on 64-bit macOS');
    });
  });

  describe('number', () => {
    it.each([
      ['2008', 2008],
      ['2013', 2013],
      ['2018', 2018],
      ['latest', Number.parseInt(Version.LATEST)],
    ])('returns the version number for %p', (spec, n) => {
      expect(new Version(spec)).toHaveProperty('number', n);
    });
  });

  describe('isLatest', () => {
    it.each([
      [false, '2008'],
      [false, '2020'],
      [true, 'latest'],
      [true, Version.LATEST],
    ])('returns %p for %p', (bool, spec) => {
      expect(new Version(spec).isLatest()).toBe(bool);
    });
  });

  describe('checkLatest', () => {
    const latest = Version.LATEST;

    afterEach(() => {
      (Version as any).latest = latest;
    });

    it('checks the latest version', async () => {
      jest.mocked(ctan.pkg).mockResolvedValueOnce({
        version: { number: '2050' },
      });
      await expect(Version.checkLatest()).resolves.toBe('2050');
      expect(Version.LATEST).toBe('2050');
    });
  });

  describe('resolve', () => {
    const { checkLatest } = Version;

    beforeEach(() => {
      Version.checkLatest = jest.fn().mockResolvedValue('2050');
    });

    afterEach(() => {
      Version.checkLatest = checkLatest;
    });

    it.each(['2019', 'latest'])('does not call checkLatest', async (spec) => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2020, 1));
      await expect(Version.resolve(spec)).toResolve();
      expect(Version.checkLatest).not.toHaveBeenCalled();
    });

    it.each(['2012', '2021', 'latest'])('calls checkLatest', async (spec) => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2050, 1));
      await expect(Version.resolve(spec)).toResolve();
      expect(Version.checkLatest).toHaveBeenCalled();
    });

    it('does not fail even if checkLatest fails', async () => {
      jest.spyOn(globalThis.Date, 'now').mockReturnValueOnce(Date.UTC(2050, 1));
      jest.mocked(Version.checkLatest).mockRejectedValueOnce(new Error());
      await expect(Version.resolve('latest')).toResolve();
      expect(Version.checkLatest).toHaveBeenCalled();
    });
  });
});

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

    it('detects forcible removal of packages', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr:
          'TeXLive::TLUtils::check_file_and_remove: checksums differ for /tmp/path/to/foo.tar.xz:\n'
          + 'TeXLive::TLUtils::check_file_and_remove: ...',
      });
      await expect(tlmgr.install(['foo', 'bar', 'baz'])).rejects.toThrow(
        'The checksum of package foo did not match.',
      );
    });

    it('tries to determine the CTAN name', async () => {
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
        stderr: [
          'tlmgr: repository or its tag already defined, no action: <repository>',
          'tlmgr: An error has occurred. See above messages. Exiting.',
        ]
          .join('\n'),
      });
      const tlmgr = new Tlmgr(v`2019`, '');
      await expect(tlmgr.repository.add('<repository>', '<tag>')).toResolve();
    });

    it('fails with non-zero status code', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
        exitCode: 2,
        stdout: '',
        stderr: [
          'tlmgr: neither https?/ftp/ssh/scp/file URI nor absolute path, no action: <repository>',
          'tlmgr: An error has occurred. See above messages. Exiting.',
        ]
          .join('\n'),
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
        .toThrow(
          '`repository` action is not implemented in TeX Live 2011',
        );
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

describe('DependsTxt.parse', () => {
  it('parses DEPENDS.txt', () => {
    const manifest = new DependsTxt(
      [
        'foo bar  baz',
        'hard\tqux ',
        ' soft quux# this is a comment',
        '',
        'package corge\t# this is a comment',
        '#',
        '  package  grault  ',
        'soft garply#',
        ' waldo',
        'package\tcorge',
        '  \tbaz',
      ]
        .join('\n'),
    );
    expect(manifest.get('')).toHaveProperty(
      'hard',
      new Set(['foo', 'bar', 'baz', 'qux']),
    );
    expect(manifest.get('')).toHaveProperty('soft', new Set(['quux']));
    expect(manifest.get('corge')).toHaveProperty('hard', new Set(['baz']));
    expect(manifest.get('corge')).not.toHaveProperty('soft');
    expect(manifest.get('grault')).toHaveProperty('hard', new Set(['waldo']));
    expect(manifest.get('grault')).toHaveProperty('soft', new Set(['garply']));
    expect([...manifest]).toHaveLength(3);
  });

  it('tolerates some syntax errors', () => {
    const manifest = new DependsTxt(
      [
        'package', // no argument
        'package#', // no argument
        'hard', // no argument
        'soft#', // no argument, immediately followed by a comment
        'package foo bar', // multiple arguments
        'soft', // no argument, with immediate EOF
      ]
        .join('\n'),
    );
    expect(manifest.get('')).not.toHaveProperty('hard');
    expect(manifest.get('')).not.toHaveProperty('soft');
    expect([...manifest]).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});
