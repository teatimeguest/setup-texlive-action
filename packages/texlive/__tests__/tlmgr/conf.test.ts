import { describe, expect, it, vi } from 'vitest';

import { exportVariable } from '@actions/core';
import { exec } from '@setup-texlive-action/utils';

import * as conf from '#texlive/tlmgr/actions/conf';
import { TlmgrInternals, set } from '#texlive/tlmgr/internals';
import { makeLocalSkeleton } from '#texlive/tlpkg';
import type { Version } from '#texlive/version';

vi.unmock('#texlive/tlmgr/actions/conf');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

describe('texmf', () => {
  it('returns the value of the given key by using `kpsewhich`', async () => {
    setVersion('2021');
    await expect(conf.texmf('TEXMFCONFIG')).resolves.toBe('<TEXMFCONFIG>');
  });

  it('sets the value to the given key with `tlmgr`', async () => {
    setVersion('2021');
    await conf.texmf('TEXMFVAR', '~/.local/texlive/2021/texmf-var');
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'conf',
      expect.anything(),
    );
    expect(exportVariable).not.toHaveBeenCalled();
  });

  it('sets the value to the given key by environment variable', async () => {
    setVersion('2008');
    await conf.texmf('TEXMFHOME', '~/.texmf');
    expect(TlmgrInternals.prototype.exec).not.toHaveBeenCalled();
    expect(exportVariable).toHaveBeenCalledWith('TEXMFHOME', '~/.texmf');
  });

  it('initializes TEXMFLOCAL if it is changed', async () => {
    setVersion(LATEST_VERSION);
    await conf.texmf('TEXMFLOCAL', '<TEXMFLOCAL>');
    expect(makeLocalSkeleton).toHaveBeenCalledWith(
      '<TEXMFLOCAL>',
      expect.anything(),
    );
    expect(exec).toHaveBeenCalledWith('mktexlsr', ['<TEXMFLOCAL>']);
  });
});
