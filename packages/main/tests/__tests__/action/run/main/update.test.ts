import { beforeEach, expect, it, vi } from 'vitest';

import { CacheService } from '#/action/cache';
import { updateTlmgr } from '#/action/run/main/update';
import { Tlmgr, TlmgrError, TlpdbError } from '#/texlive';
import { list, remove } from '#/texlive/tlmgr/actions/repository';
import { update } from '#/texlive/tlmgr/actions/update';

const updateCache = vi.fn();

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
  vi.mocked(update).mockRejectedValueOnce(versionOutdated);
  const opts = { version: LATEST_VERSION };
  await expect(updateTlmgr(opts)).resolves.not.toThrow();
  expect(updateCache).toHaveBeenCalled();
});

it('move to historic master', async () => {
  vi
    .mocked(update)
    .mockRejectedValueOnce(versionOutdated)
    .mockRejectedValueOnce(failedToInitialize);
  const opts = { version: LATEST_VERSION };
  await expect(updateTlmgr(opts)).resolves.not.toThrow();
  expect(updateCache).toHaveBeenCalled();
});

it('does not move to historic if repository set', async () => {
  vi.mocked(update).mockRejectedValueOnce(versionOutdated);
  const opts = { version: LATEST_VERSION, repository: new URL(MOCK_URL) };
  await expect(updateTlmgr(opts)).rejects.toThrow(versionOutdated);
});

it('removes tlcontrib', async () => {
  vi.mocked(list).mockImplementationOnce(async function*() {
    yield { tag: 'main', path: MOCK_URL };
    yield { tag: 'tlcontrib', path: MOCK_URL };
  });
  const opts = { version: '2023' } as const;
  await expect(updateTlmgr(opts)).resolves.not.toThrow();
  expect(remove).toHaveBeenCalledWith('tlcontrib');
});

it('removes tlpretest', async () => {
  vi.mocked(list).mockImplementationOnce(async function*() {
    yield { tag: 'main', path: 'https://example.com/path/to/tlpretest/' };
    yield { tag: 'tlcontrib', path: MOCK_URL };
  });
  const opts = { version: LATEST_VERSION };
  await expect(updateTlmgr(opts)).resolves.not.toThrow();
  expect(remove).toHaveBeenCalledWith('main');
});
