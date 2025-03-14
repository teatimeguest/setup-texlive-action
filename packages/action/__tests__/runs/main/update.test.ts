import { beforeEach, expect, it, vi } from 'vitest';

import {
  Tlmgr,
  TlmgrError,
  TlpdbError,
  tlmgr,
} from '@setup-texlive-action/texlive';

import { CacheService } from '#action/cache';
import { update } from '#action/runs/main/update';

const { repository: { list, remove } } = tlmgr;

const updateCache = vi.fn();

vi.unmock('#action/runs/main/update');

vi.mocked(list).mockImplementation(async function*() {});
vi.mocked(CacheService.use).mockReturnValue(
  { update: updateCache } as unknown as CacheService,
);

beforeEach(() => {
  Tlmgr.setup({ version: LATEST_VERSION, TEXDIR: '<TEXDIR>' });
});

const versionOutdated = new TlmgrError('', {
  action: 'update',
  code: TlmgrError.Code.TL_VERSION_OUTDATED,
});

const failedToInitialize = new TlpdbError('', {
  code: TlpdbError.Code.FAILED_TO_INITIALIZE,
});

it('move to historic', async () => {
  vi.mocked(tlmgr.update).mockRejectedValueOnce(versionOutdated);
  const opts = { version: LATEST_VERSION };
  await expect(update(opts)).resolves.not.toThrow();
  expect(updateCache).toHaveBeenCalled();
});

it('move to historic master', async () => {
  vi
    .mocked(tlmgr.update)
    .mockRejectedValueOnce(versionOutdated)
    .mockRejectedValueOnce(failedToInitialize);
  const opts = { version: LATEST_VERSION };
  await expect(update(opts)).resolves.not.toThrow();
  expect(updateCache).toHaveBeenCalled();
});

it('does not move to historic if repository set', async () => {
  vi.mocked(tlmgr.update).mockRejectedValueOnce(versionOutdated);
  const opts = { version: LATEST_VERSION, repository: new URL(MOCK_URL) };
  await expect(update(opts)).rejects.toThrow(versionOutdated);
});

it('removes tlcontrib', async () => {
  vi.mocked(list).mockImplementationOnce(async function*() {
    yield { tag: 'main', path: MOCK_URL };
    yield { tag: 'tlcontrib', path: MOCK_URL };
  });
  const opts = { version: '2024' } as const;
  await expect(update(opts)).resolves.not.toThrow();
  expect(remove).toHaveBeenCalledWith('tlcontrib');
});

it('removes tlpretest', async () => {
  vi.mocked(list).mockImplementationOnce(async function*() {
    yield { tag: 'main', path: 'https://example.com/path/to/tlpretest/' };
    yield { tag: 'tlcontrib', path: MOCK_URL };
  });
  const opts = { version: LATEST_VERSION };
  await expect(update(opts)).resolves.not.toThrow();
  expect(remove).toHaveBeenCalledWith('main');
});

it('defaults to update only tlmgr', async () => {
  await expect(update({ version: LATEST_VERSION }))
    .resolves
    .not
    .toThrow();
  expect(tlmgr.update).toHaveBeenCalledWith({
    self: true,
    all: false,
    reinstallForciblyRemoved: false,
  });
});

it('calls `tlmgr update --all` if `updateAllPackages: true`', async () => {
  await expect(update({ version: LATEST_VERSION, updateAllPackages: true }))
    .resolves
    .not
    .toThrow();
  expect(tlmgr.update).toHaveBeenCalledWith({
    self: true,
    all: true,
    reinstallForciblyRemoved: true,
  });
});
