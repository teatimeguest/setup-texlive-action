import { exec, getExecOutput } from '@actions/exec';

import * as ctan from '#/ctan';
import { Tlmgr } from '#/texlive/tlmgr';
import { Version } from '#/texlive/version';

jest.unmock('#/texlive/tlmgr');

const v = (spec: unknown) => new Version(`${spec}`);

describe('Tlmgr', () => {
  describe('install', () => {
    const tlmgr = new Tlmgr({ version: v`latest`, TEXDIR: '' });

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

  describe('update', () => {
    it('updates packages', async () => {
      const tlmgr = new Tlmgr({ version: v`latest`, TEXDIR: '' });
      await expect(tlmgr.update(['foo', 'bar', 'baz'])).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['update', 'foo', 'bar', 'baz'],
        expect.anything(),
      );
    });

    it('updates tlmgr itself', async () => {
      const tlmgr = new Tlmgr({ version: v`latest`, TEXDIR: '' });
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['update', '--self'],
        expect.anything(),
      );
    });

    it('updates tlmgr itself by updating texlive.infra', async () => {
      const tlmgr = new Tlmgr({ version: v`2008`, TEXDIR: '' });
      await expect(tlmgr.update(undefined, { self: true })).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['update', 'texlive.infra'],
        expect.anything(),
      );
    });

    it('updates all packages', async () => {
      const tlmgr = new Tlmgr({ version: v`latest`, TEXDIR: '' });
      await expect(tlmgr.update(undefined, { all: true })).toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['update', '--all'],
        expect.anything(),
      );
    });

    it('updates packages with `--reinstall-forcibly-removed`', async () => {
      const tlmgr = new Tlmgr({ version: v`latest`, TEXDIR: '' });
      await expect(
        tlmgr.update(['foo', 'bar', 'baz'], { reinstallForciblyRemoved: true }),
      )
        .toResolve();
      expect(getExecOutput).toHaveBeenCalledWith(
        'tlmgr',
        ['update', '--reinstall-forcibly-removed', 'foo', 'bar', 'baz'],
        expect.anything(),
      );
    });
  });
});
