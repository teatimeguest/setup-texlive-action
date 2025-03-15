import { describe, expect, it, vi } from 'vitest';

import stderr from '@setup-texlive-action/fixtures/tlmgr-repository-add.stderr';
import { ExecError } from '@setup-texlive-action/utils';

import * as repository from '#texlive/tlmgr/actions/repository';
import { TlmgrInternals, set } from '#texlive/tlmgr/internals';
import type { Version } from '#texlive/version';

vi.unmock('#texlive/tlmgr/actions/repository');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

describe('add', () => {
  it('adds a repository with a tag', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>', '<tag>'))
      .resolves
      .not
      .toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('adds a repository with the empty tag', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>', '')).resolves.not.toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('adds a repository with no tags', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>')).resolves.not.toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('can safely add the repository again', async () => {
    vi.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
      new ExecError({
        command: 'tlmgr',
        exitCode: 2,
        stdout: '',
        stderr,
      }),
    );
    setVersion('2019');
    await expect(repository.add('<repository>', '<tag>'))
      .resolves
      .not
      .toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalled();
  });

  it('fails with non-zero status code', async () => {
    vi.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
      new ExecError({
        command: 'tlmgr',
        exitCode: 2,
        stdout: '',
        stderr: '',
      }),
    );
    setVersion('2019');
    await expect(repository.add('<repository>', '<tag>'))
      .rejects
      .toThrow('`tlmgr` exited with status 2');
  });

  it('fails since the `repository` action is not implemented', async () => {
    setVersion('2011');
    await expect(repository.add('<repository>', '<tag>')).rejects.toThrow(/./v);
  });
});
