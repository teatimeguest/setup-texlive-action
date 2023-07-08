import * as core from '@actions/core';

import { Version, tlpkg } from '#/texlive';
import { Conf } from '#/texlive/tlmgr/conf';
import { ExecResult, exec } from '#/util';

jest.unmock('#/texlive/tlmgr/conf');

const v = (spec: unknown) => new Version(`${spec}`);

describe('texmf', () => {
  it('returns the value of the given key by using `kpsewhich`', async () => {
    jest.mocked(exec).mockResolvedValueOnce(
      new ExecResult({
        command: '',
        exitCode: 0,
        stdout: '/usr/local/texlive/2021/texmf-config\n',
        stderr: '',
      }),
    );
    const conf = new Conf({ version: v`2021`, TEXDIR: '' });
    await expect(conf.texmf('TEXMFCONFIG')).resolves.toBe(
      '/usr/local/texlive/2021/texmf-config',
    );
  });

  it('sets the value to the given key with `tlmgr`', async () => {
    const conf = new Conf({ version: v`2021`, TEXDIR: '' });
    await conf.texmf('TEXMFVAR', '~/.local/texlive/2021/texmf-var');
    expect(exec).toHaveBeenCalledWith('tlmgr', [
      'conf',
      'texmf',
      'TEXMFVAR',
      '~/.local/texlive/2021/texmf-var',
    ]);
  });

  it('sets the value to the given key by environment variable', async () => {
    const conf = new Conf({ version: v`2008`, TEXDIR: '' });
    await conf.texmf('TEXMFHOME', '~/.texmf');
    expect(core.exportVariable).toHaveBeenCalledWith('TEXMFHOME', '~/.texmf');
  });

  it('initializes TEXMFLOCAL if it is changed', async () => {
    const conf = new Conf({ version: v`latest`, TEXDIR: '' });
    await conf.texmf('TEXMFLOCAL', '<TEXMFLOCAL>');
    expect(exec).toHaveBeenCalledWith('tlmgr', expect.anything());
    expect(tlpkg.makeLocalSkeleton).toHaveBeenCalledWith(
      '<TEXMFLOCAL>',
      expect.anything(),
    );
    expect(exec).toHaveBeenCalledWith('mktexlsr', ['<TEXMFLOCAL>']);
  });
});
