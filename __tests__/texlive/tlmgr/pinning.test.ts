import { exec } from '@actions/exec';

import { Pinning } from '#/texlive/tlmgr/pinning';
import { Version } from '#/texlive/version';

jest.unmock('#/texlive/tlmgr/pinning');

const v = (spec: unknown) => new Version(`${spec}`);

describe('add', () => {
  it('pins a repository with a glob', async () => {
    const pinning = new Pinning({ version: v`2019` });
    await pinning.add('<repository>', '*');
    expect(exec).toHaveBeenCalledWith('tlmgr', [
      'pinning',
      'add',
      '<repository>',
      '*',
    ]);
  });

  it('pins a repository with globs', async () => {
    const pinning = new Pinning({ version: v`2019` });
    await pinning.add('<repository>', '<glob1>', '<glob2>');
    expect(exec).toHaveBeenCalledWith('tlmgr', [
      'pinning',
      'add',
      '<repository>',
      '<glob1>',
      '<glob2>',
    ]);
  });

  it('fails since the `pinning` action is not implemented', () => {
    expect(() => new Pinning({ version: v`2012` })).toThrow(
      '`pinning` action is not implemented in TeX Live 2012',
    );
  });
});
