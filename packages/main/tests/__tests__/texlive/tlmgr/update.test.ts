import { expect, it, vi } from 'vitest';

import { update } from '#/texlive/tlmgr/actions/update';
import { TlmgrInternals, set } from '#/texlive/tlmgr/internals';
import type { Version } from '#/texlive/version';

vi.unmock('#/texlive/tlmgr/actions/update');

const setVersion = (version: Version) => {
  set(new TlmgrInternals({ TEXDIR: '', version }), true);
};

it('updates packages', async () => {
  setVersion(LATEST_VERSION);
  await expect(update(['foo', 'bar', 'baz'])).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    'foo',
    'bar',
    'baz',
  ]);
});

it('updates tlmgr itself', async () => {
  setVersion(LATEST_VERSION);
  await expect(update({ self: true })).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--self',
  ]);
});

it('updates tlmgr itself by updating texlive.infra', async () => {
  setVersion('2008');
  await expect(update({ self: true })).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    'texlive.infra',
  ]);
});

it('updates all packages', async () => {
  setVersion(LATEST_VERSION);
  await expect(update(['foo', 'bar'], { all: true })).toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--all',
  ]);
});

it('updates packages with `--reinstall-forcibly-removed`', async () => {
  setVersion(LATEST_VERSION);
  await expect(
    update(['foo', 'bar', 'baz'], { reinstallForciblyRemoved: true }),
  )
    .toResolve();
  expect(TlmgrInternals.prototype.exec).toHaveBeenCalledWith('update', [
    '--reinstall-forcibly-removed',
    'foo',
    'bar',
    'baz',
  ]);
});
