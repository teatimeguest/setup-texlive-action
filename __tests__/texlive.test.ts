import * as core from '@actions/core';
import * as exec from '@actions/exec';
import 'jest-extended';

import * as log from '#/log';
import { DependsTxt, Tlmgr, Version } from '#/texlive';
import * as util from '#/utility';

jest.mock('os', () => ({ platform: jest.fn().mockReturnValue('linux') }));

jest.mocked(core.group).mockImplementation(async (name, fn) => await fn());
jest.mocked(exec.getExecOutput).mockResolvedValue({
  exitCode: 0,
  stdout: '',
  stderr: '',
});
jest.unmock('#/texlive');

describe('Version', () => {
  test.each([
    ['1996', false],
    ['2007', false],
    ['2008', true],
    ['2015', true],
    ['2022', true],
    ['2023', false],
    ['latest', false],
  ])('isVersion(%o)', (version, result) => {
    expect(Version.isVersion(version)).toBe(result);
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
      const tlmgr = new Tlmgr('2021', '/usr/local/texlive');
      await expect(tlmgr.conf.texmf('TEXMFCONFIG')).resolves.toBe(
        '/usr/local/texlive/2021/texmf-config',
      );
    });

    it('sets the value to the given key with `tlmgr`', async () => {
      const tlmgr = new Tlmgr('2021', '/usr/local/texlive');
      await tlmgr.conf.texmf('TEXMFVAR', '~/.local/texlive/2021/texmf-var');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'conf',
        'texmf',
        'TEXMFVAR',
        '~/.local/texlive/2021/texmf-var',
      ]);
    });

    it('sets the value to the given key by environment variable', async () => {
      const tlmgr = new Tlmgr('2008', '/usr/local/texlive');
      await tlmgr.conf.texmf('TEXMFHOME', '~/.texmf');
      expect(core.exportVariable).toHaveBeenCalledWith('TEXMFHOME', '~/.texmf');
    });
  });

  describe('install', () => {
    const tlmgr = new Tlmgr(Version.LATEST, '/usr/local/texlive');

    it('does not invoke `tlmgr install` if the argument is empty', async () => {
      await tlmgr.install();
      expect(exec.exec).not.toHaveBeenCalled();
    });

    it('installs packages by invoking `tlmgr install`', async () => {
      const packages = ['foo', 'bar', 'baz'];
      await tlmgr.install(...packages);
      expect(exec.getExecOutput).toHaveBeenCalledWith('tlmgr', [
        'install',
        ...packages,
      ]);
    });

    it('detects forcible removal of packages', async () => {
      jest.mocked(exec.getExecOutput).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '',
        stderr:
          'TeXLive::TLUtils::check_file_and_remove: checksums differ for /tmp/path/to/foo.tar.xz:\n'
          + 'TeXLive::TLUtils::check_file_and_remove: ...',
      });
      await expect(tlmgr.install('foo', 'bar', 'baz')).rejects.toThrow(
        'The checksum of package foo did not match.',
      );
    });
  });

  describe('path.add', () => {
    const tlmgr = new Tlmgr('2019', '/usr/local/texlive');

    it('adds the bin directory to the PATH', async () => {
      jest.mocked(util.determine).mockResolvedValueOnce('<path>');
      await tlmgr.path.add();
      expect(core.addPath).toHaveBeenCalledWith('<path>');
    });

    it('fails as the bin directory cannot be located', async () => {
      jest.mocked(util.determine).mockResolvedValueOnce(undefined);
      await expect(tlmgr.path.add()).rejects.toThrow(
        "Unable to locate TeX Live's binary directory",
      );
    });
  });

  describe('pinning.add', () => {
    it('pins a repository with a glob', async () => {
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await tlmgr.pinning.add('<repository>', '*');
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'pinning',
        'add',
        '<repository>',
        '*',
      ]);
    });

    it('pins a repository with globs', async () => {
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
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
      const tlmgr = new Tlmgr('2012', '/usr/local/texlive');
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
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add('<repository>', '<tag>')).resolves.toBe(
        true,
      );
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', '<tag>'],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with the empty tag', async () => {
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add('<repository>', '')).resolves.toBe(
        true,
      );
      expect(exec.getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['repository', 'add', '<repository>', ''],
        expect.objectContaining({ ignoreReturnCode: true }),
      );
    });

    it('adds a repository with no tags', async () => {
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add('<repository>')).resolves.toBe(true);
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
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await expect(tlmgr.repository.add('<repository>', '<tag>')).resolves.toBe(
        false,
      );
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
      const tlmgr = new Tlmgr('2019', '/usr/local/texlive');
      await expect(
        tlmgr.repository.add('<repository>', '<tag>'),
      )
        .rejects
        .toThrow(/^`tlmgr` failed with exit code 2: /u);
    });

    it('fails since the `repository` action is not implemented', async () => {
      const tlmgr = new Tlmgr('2011', '/usr/local/texlive');
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
      const tlmgr = new Tlmgr(Version.LATEST, '');
      await expect(tlmgr.update(['foo', 'bar', 'baz'])).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'foo',
        'bar',
        'baz',
      ]);
    });

    it('updates tlmgr itself', async () => {
      const tlmgr = new Tlmgr(Version.LATEST, '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['update', '--self']);
    });

    it('updates tlmgr itself by updating texlive.infra', async () => {
      const tlmgr = new Tlmgr('2008', '');
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', [
        'update',
        'texlive.infra',
      ]);
    });

    it('updates all packages', async () => {
      const tlmgr = new Tlmgr(Version.LATEST, '');
      await expect(tlmgr.update(undefined, { all: true })).toResolve();
      expect(exec.exec).toHaveBeenCalledWith('tlmgr', ['update', '--all']);
    });

    it('updates packages with `--reinstall-forcibly-removed`', async () => {
      const tlmgr = new Tlmgr(Version.LATEST, '');
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
    const manifest = DependsTxt.parse(
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
      ]
        .join('\n'),
    );
    expect(manifest.get('')).toHaveProperty(
      'hard',
      new Set(['foo', 'bar', 'baz', 'qux']),
    );
    expect(manifest.get('')).toHaveProperty('soft', new Set(['quux']));
    expect(manifest.get('corge')).toHaveProperty('hard', new Set());
    expect(manifest.get('corge')).toHaveProperty('soft', new Set());
    expect(manifest.get('grault')).toHaveProperty('hard', new Set(['waldo']));
    expect(manifest.get('grault')).toHaveProperty('soft', new Set(['garply']));
    expect([...manifest.keys()]).toStrictEqual(['', 'corge', 'grault']);
  });

  it('tolerates some syntax errors', () => {
    const manifest = DependsTxt.parse(
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
    expect(manifest.get('')).toHaveProperty('hard', new Set());
    expect(manifest.get('')).toHaveProperty('soft', new Set());
    expect([...manifest.keys()]).toStrictEqual(['']);
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});
