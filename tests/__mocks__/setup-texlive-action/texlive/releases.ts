export namespace ReleaseData {
  const data = {
    latest: { version: LATEST_VERSION },
    isLatest: vi.fn((version: typeof LATEST_VERSION) => {
      return version === LATEST_VERSION;
    }),
  };
  export const setup = vi.fn().mockResolvedValue(data);
  export const use = vi.fn().mockReturnValue(data);
}
