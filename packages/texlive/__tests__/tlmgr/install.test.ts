import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';

import shellesc from '@setup-texlive-action/fixtures/ctan-api-pkg-shellesc.json';
import stderr2008 from '@setup-texlive-action/fixtures/tlmgr-install.2008.stderr';
import stderr2009 from '@setup-texlive-action/fixtures/tlmgr-install.2009.stderr';
import stderr2014 from '@setup-texlive-action/fixtures/tlmgr-install.2014.stderr';
import stderr2023 from '@setup-texlive-action/fixtures/tlmgr-install.2023.stderr';
import { ExecResult } from '@setup-texlive-action/utils';
import nock from 'nock';

import { install } from '#texlive/tlmgr/actions/install';
import { TlmgrInternals, set } from '#texlive/tlmgr/internals';
import type { Version } from '#texlive/version';

const toTL: Record<string, string | undefined> = {};
vi.mock('node:timers/promises');
vi.mock('@setup-texlive-action/data/package-names.json', () => ({
  get toTL() {
    return toTL;
  },
}));
vi.unmock('@actions/http-client');
vi.unmock('#texlive/tlmgr/actions/install');

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

describe.each(
  [
    ['2008', 0, stderr2008],
    ['2009', 0, stderr2009],
    ['2014', 0, stderr2014],
    ['2023', 1, stderr2023],
  ] as const,
)('tries to determine the TL name (%s)', (version, exitCode, stderr) => {
  const error = new ExecResult({ command: '', exitCode, stdout: '', stderr });

  beforeEach(() => {
    setVersion(version);
    vi.mocked(TlmgrInternals.prototype.exec).mockResolvedValueOnce(error);
    toTL['shellesc'] = 'tools';
    nock('https://ctan.org')
      .persist()
      .get('/json/2.0/pkg/shellesc')
      .query(true)
      .reply(200, shellesc);
  });

  afterEach(nock.cleanAll);

  test('using the pre-generated dictionary', async () => {
    await expect(install(['shellesc', 'latex'])).resolves.not.toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'install',
      new Set(['shellesc', 'latex']),
      expect.anything(),
    );
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'install',
      new Set(['tools']),
      expect.anything(),
    );
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledTimes(2);
    expect(nock.isDone()).toBe(false);
  });

  test('using the CTAN API', async () => {
    toTL['shellesc'] = 'shellesc';
    vi.mocked(TlmgrInternals.prototype.exec).mockResolvedValueOnce(error);
    await expect(install(['shellesc', 'latex'])).resolves.not.toThrow();
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'install',
      new Set(['shellesc', 'latex']),
      expect.anything(),
    );
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'install',
      new Set(['shellesc']),
      expect.anything(),
    );
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith(
      'install',
      new Set(['tools']),
      expect.anything(),
    );
    expect(TlmgrInternals.prototype.exec).toHaveBeenCalledTimes(3);
    expect(nock.isDone()).toBe(true);
  });
});
