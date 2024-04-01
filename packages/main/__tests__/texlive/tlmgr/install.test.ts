import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import shellesc from '@setup-texlive-action/fixtures/ctan-api-pkg-shellesc.json';
import stderr2008 from '@setup-texlive-action/fixtures/tlmgr-install.2008.stderr';
import stderr2009 from '@setup-texlive-action/fixtures/tlmgr-install.2009.stderr';
import stderr2014 from '@setup-texlive-action/fixtures/tlmgr-install.2014.stderr';
import stderr2023 from '@setup-texlive-action/fixtures/tlmgr-install.2023.stderr';
import { ExecResult } from '@setup-texlive-action/utils';
import nock from 'nock';

import { install } from '#/texlive/tlmgr/actions/install';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Version } from '#/texlive/version';

vi.unmock('@actions/http-client');
vi.unmock('#/texlive/tlmgr/actions/install');

beforeAll(async () => {
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
    ['2008', 0, stderr2008],
    ['2009', 0, stderr2009],
    ['2014', 0, stderr2014],
    ['2023', 1, stderr2023],
  ] as const,
)('tries to determine the TL name (%s)', async (version, exitCode, stderr) => {
  setVersion(version);
  vi.mocked(TlmgrInternals.prototype.exec).mockResolvedValueOnce(
    new ExecResult({
      command: '',
      exitCode,
      stdout: '',
      stderr,
    }),
  );
  await expect(install(['shellesc'])).resolves.not.toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
    'install',
    new Set(['tools']),
    expect.anything(),
  );
  expect(nock.isDone()).toBe(true);
});
