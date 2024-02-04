import { vi } from 'vitest';

export namespace ReleaseData {
  const data = {
    newVersionReleased: vi.fn().mockReturnValue(false),
    latest: { version: LATEST_VERSION },
    isLatest: vi.fn((version: typeof LATEST_VERSION) => {
      return version === LATEST_VERSION;
    }),
    isOnePrevious: vi.fn((version: typeof LATEST_VERSION) => {
      return Number.parseInt(version, 10) + 1
        === Number.parseInt(LATEST_VERSION, 10);
    }),
  };
  export const setup = vi.fn().mockResolvedValue(data);
  export const use = vi.fn().mockReturnValue(data);
}
