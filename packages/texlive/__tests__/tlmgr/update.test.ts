import { expect, it, vi } from 'vitest';

import stderrCtan from '@setup-texlive-action/fixtures/tlmgr-setup_one_remotetlpdb-ctan.stderr';
import stderrTlcontrib from '@setup-texlive-action/fixtures/tlmgr-setup_one_remotetlpdb-tlcontrib.stderr';
import { ExecError } from '@setup-texlive-action/utils';

import { update } from '#texlive/tlmgr/actions/update';
import { TlmgrError } from '#texlive/tlmgr/errors';
import { TlmgrInternals, set } from '#texlive/tlmgr/internals';
import type { Version } from '#texlive/version';

vi.unmock('#texlive/tlmgr/actions/update');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

it('updates packages', async () => {
  setVersion(LATEST_VERSION);
  await expect(update(['foo', 'bar', 'baz'])).resolves.not.toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    'foo',
    'bar',
    'baz',
  ]);
});

it('updates tlmgr itself', async () => {
  setVersion(LATEST_VERSION);
  await expect(update({ self: true })).resolves.not.toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--self',
  ]);
});

it('updates tlmgr itself by updating texlive.infra', async () => {
  setVersion('2008');
  await expect(update({ self: true })).resolves.not.toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    'texlive.infra',
  ]);
});

it('updates all packages', async () => {
  setVersion(LATEST_VERSION);
  await expect(update(['foo', 'bar'], { all: true })).resolves.not.toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--all',
  ]);
});

it('updates packages with `--reinstall-forcibly-removed`', async () => {
  setVersion(LATEST_VERSION);
  await expect(
    update(['foo', 'bar', 'baz'], { reinstallForciblyRemoved: true }),
  )
    .resolves
    .not
    .toThrow();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--reinstall-forcibly-removed',
    'foo',
    'bar',
    'baz',
  ]);
});

it('throws TLVersionOutdated', async () => {
  setVersion('2022');
  vi.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
    new ExecError({
      command: 'tlmgr',
      stderr: stderrCtan,
      stdout: '',
      exitCode: 1,
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await expect(update()).rejects.toThrow(expect.objectContaining({
    code: TlmgrError.Code.TL_VERSION_OUTDATED,
  }));
});

it('throws TLVersionNotSupported', async () => {
  setVersion('2022');
  vi.mocked(TlmgrInternals.prototype.exec).mockRejectedValueOnce(
    new ExecError({
      command: 'tlmgr',
      stderr: stderrTlcontrib,
      stdout: '',
      exitCode: 1,
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await expect(update()).rejects.toThrow(expect.objectContaining({
    code: TlmgrError.Code.TL_VERSION_NOT_SUPPORTED,
  }));
});
