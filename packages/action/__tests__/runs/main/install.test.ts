import { describe, expect, it, vi } from 'vitest';

import {
  type InstallTL,
  InstallTLError,
  Profile,
  TlpdbError,
  acquire,
} from '@setup-texlive-action/texlive';

import { install } from '#action/runs/main/install';

vi.unmock('#action/runs/main/install');

vi.mocked(acquire).mockResolvedValue({ run: vi.fn() } as unknown as InstallTL);

const downloadErrors = [
  new InstallTLError('', { code: InstallTLError.Code.FAILED_TO_DOWNLOAD }),
  new InstallTLError('', { code: InstallTLError.Code.UNEXPECTED_VERSION }),
] as const;

const installErrors = [
  new InstallTLError('', {
    code: InstallTLError.Code.INCOMPATIBLE_REPOSITORY_VERSION,
  }),
  new TlpdbError('', { code: TlpdbError.Code.FAILED_TO_INITIALIZE }),
] as const;

const errors = [...downloadErrors, ...installErrors] as const;

describe('fallback to master', () => {
  it.each(downloadErrors)('if failed to download', async (error) => {
    vi.mocked(acquire).mockRejectedValueOnce(error);
    const profile = new Profile(LATEST_VERSION, { prefix: '' });
    await expect(install({ profile })).resolves.not.toThrow();
  });

  it.each(installErrors)('if failed to install', async (error) => {
    vi.mocked(acquire).mockResolvedValueOnce({
      run: vi.fn().mockRejectedValueOnce(error),
    } as unknown as InstallTL);
    const profile = new Profile(LATEST_VERSION, { prefix: '' });
    await expect(install({ profile })).resolves.not.toThrow();
  });
});

it.each(errors)('does not fallback for older versions', async (error) => {
  vi.mocked(acquire).mockRejectedValueOnce(error);
  const profile = new Profile('2021', { prefix: '' });
  await expect(install({ profile })).rejects.toThrow(error);
});

it.each(errors)('does not fallback if repository set', async (error) => {
  vi.mocked(acquire).mockRejectedValueOnce(error);
  const profile = new Profile(LATEST_VERSION, { prefix: '' });
  const repository = new URL(MOCK_URL);
  await expect(install({ profile, repository })).rejects.toThrow(error);
});
