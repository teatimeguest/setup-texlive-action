import { Pinning } from '#/texlive/tlmgr/pinning';
import { exec } from '#/util';

jest.unmock('#/texlive/tlmgr/pinning');

describe('add', () => {
  it('pins a repository with a glob', async () => {
    const pinning = new Pinning({ version: '2019' });
    await pinning.add('<repository>', '*');
    expect(exec).toHaveBeenCalledWith('tlmgr', [
      'pinning',
      'add',
      '<repository>',
      '*',
    ]);
  });

  it('pins a repository with globs', async () => {
    const pinning = new Pinning({ version: '2019' });
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
    expect(() => new Pinning({ version: '2012' })).toThrow(
      '`pinning` action is not implemented in TeX Live 2012',
    );
  });
});
