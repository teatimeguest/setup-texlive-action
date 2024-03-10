import { vi } from 'vitest';

export namespace ReleaseData {
  const latestVersionNumber = Number.parseInt(LATEST_VERSION, 10);
  const data = {
    newVersionReleased: vi.fn().mockReturnValue(false),
    previous: { version: `${latestVersionNumber - 1}` },
    latest: { version: LATEST_VERSION },
    next: { version: `${latestVersionNumber + 1}` },
  };
  export const setup = vi.fn().mockResolvedValue(data);
  export const use = vi.fn().mockReturnValue(data);
}
