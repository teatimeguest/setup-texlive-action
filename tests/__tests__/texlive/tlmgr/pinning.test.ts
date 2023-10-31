import * as pinning from '#/texlive/tlmgr/actions/pinning';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Version } from '#/texlive/version';

vi.unmock('#/texlive/tlmgr/actions/pinning');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

describe('add', () => {
  it('pins a repository with a glob', async () => {
    setVersion('2019');
    await pinning.add('<repository>', '*');
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'pinning',
      expect.anything(),
    );
  });

  it('pins a repository with globs', async () => {
    setVersion('2019');
    await pinning.add('<repository>', '<glob1>', '<glob2>');
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'pinning',
      expect.anything(),
    );
  });

  it('fails since the `pinning` action is not implemented', async () => {
    setVersion('2012');
    await expect(pinning.add('<repository>', '*')).toReject();
  });
});
