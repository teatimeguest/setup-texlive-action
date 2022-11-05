import { getExecOutput } from '@actions/exec';
import { dedent } from 'ts-dedent';

import { Repository } from '#/texlive/tlmgr/repository';
import { Version } from '#/texlive/version';

jest.unmock('#/texlive/tlmgr/repository');

const v = (spec: unknown) => new Version(`${spec}`);

describe('add', () => {
  it('adds a repository with a tag', async () => {
    const repository = new Repository({ version: v`2019` });
    await expect(repository.add('<repository>', '<tag>')).toResolve();
    expect(getExecOutput).toHaveBeenCalledWith(
      'tlmgr',
      ['repository', 'add', '<repository>', '<tag>'],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('adds a repository with the empty tag', async () => {
    const repository = new Repository({ version: v`2019` });
    await expect(repository.add('<repository>', '')).toResolve();
    expect(getExecOutput).toHaveBeenCalledWith(
      'tlmgr',
      ['repository', 'add', '<repository>', ''],
      expect.objectContaining({ ignoreReturnCode: true }),
    );
  });

  it('adds a repository with no tags', async () => {
    const repository = new Repository({ version: v`2019` });
    await expect(repository.add('<repository>')).toResolve();
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
    const repository = new Repository({ version: v`2019` });
    await expect(repository.add('<repository>', '<tag>')).toResolve();
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
    const repository = new Repository({ version: v`2019` });
    await expect(repository.add('<repository>', '<tag>'))
      .rejects
      .toThrow('tlmgr exited with 2');
  });

  it('fails since the `repository` action is not implemented', () => {
    expect(() => new Repository({ version: v`2011` }))
      .toThrow('`repository` action is not implemented in TeX Live 2011');
  });
});
