import * as repository from '#/texlive/tlmgr/actions/repository';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Version } from '#/texlive/version';
import { ExecError } from '#/util/exec';

jest.unmock('#/texlive/tlmgr/actions/repository');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

describe('add', () => {
  it('adds a repository with a tag', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>', '<tag>')).toResolve();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('adds a repository with the empty tag', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>', '')).toResolve();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('adds a repository with no tags', async () => {
    setVersion('2019');
    await expect(repository.add('<repository>')).toResolve();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'repository',
      expect.anything(),
    );
  });

  it('can safely add the repository again', async () => {
    // eslint-disable-next-line jest/unbound-method
    jest.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
      new ExecError({
        command: 'tlmgr',
        exitCode: 2,
        stdout: '',
        stderr: await fixtures('tlmgr-repository-add.stderr'),
      }),
    );
    setVersion('2019');
    await expect(repository.add('<repository>', '<tag>')).toResolve();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalled();
  });

  it('fails with non-zero status code', async () => {
    // eslint-disable-next-line jest/unbound-method
    jest.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
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
    await expect(repository.add('<repository>', '<tag>')).toReject();
  });
});
