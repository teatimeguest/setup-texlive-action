import nock from 'nock';

import { install } from '#/texlive/tlmgr/actions/install';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Version } from '#/texlive/version';
import { ExecResult } from '#/util/exec';

jest.unmock('@actions/http-client');
jest.unmock('#/texlive/tlmgr/actions/install');

beforeAll(async () => {
  const shellesc = await fixtures('ctan-api-pkg-shellesc.json');
  nock('https://ctan.org')
    .persist()
    .get('/json/2.0/pkg/shellesc')
    .reply(200, shellesc);
});

afterAll(nock.restore);

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

it('does not invoke `tlmgr install` if the argument is empty', async () => {
  setVersion(LATEST_VERSION);
  await install([]);
  expect(TlmgrInternals.prototype.exec).not.toHaveBeenCalled();
});

it('installs packages by invoking `tlmgr install`', async () => {
  setVersion(LATEST_VERSION);
  const packages = ['foo', 'bar', 'baz'];
  await install(packages);
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
    'install',
    new Set(packages),
    expect.anything(),
  );
});

it.each(
  [
    ['2008', 0],
    ['2009', 0],
    ['2014', 0],
    ['2023', 1],
  ] as const,
)('tries to determine the TL name (%s)', async (version, exitCode) => {
  setVersion(version);
  // eslint-disable-next-line jest/unbound-method
  jest.mocked(TlmgrInternals.prototype.exec).mockResolvedValueOnce(
    new ExecResult({
      command: '',
      exitCode,
      stdout: '',
      stderr: await fixtures(`tlmgr-install.${version}.stderr`),
    }),
  );
  await expect(install(['shellesc'])).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
    'install',
    new Set(['tools']),
    expect.anything(),
  );
  expect(nock.isDone()).toBeTrue();
});
