import { install } from '#/texlive/tlmgr/actions/install';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import { ExecResult } from '#/util/exec';

jest.unmock('#/texlive/tlmgr/actions/install');

beforeEach(() => {
  set(new TlmgrInternals({ TEXDIR: '', version: LATEST_VERSION }));
});

it('does not invoke `tlmgr install` if the argument is empty', async () => {
  await install([]);
  expect(TlmgrInternals.prototype.exec).not.toHaveBeenCalled();
});

it('installs packages by invoking `tlmgr install`', async () => {
  const packages = ['foo', 'bar', 'baz'];
  await install(packages);
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
    'install',
    expect.anything(),
    expect.anything(),
  );
});

it('tries to determine the TL name', async () => {
  // eslint-disable-next-line jest/unbound-method
  jest.mocked(TlmgrInternals.prototype.exec).mockResolvedValueOnce(
    new ExecResult({
      command: '',
      exitCode: 1,
      stdout: '',
      stderr: await loadFixture(`tlmgr-install.stderr`),
    }),
  );
  await expect(install(['shellesc'])).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
    'install',
    ['tools'],
    expect.anything(),
  );
});
