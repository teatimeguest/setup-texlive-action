export namespace ReleaseData {
  const data = {
    latest: { version: LATEST_VERSION },
    isLatest: jest.fn((version: typeof LATEST_VERSION) => {
      return version === LATEST_VERSION;
    }),
  };
  export const setup = jest.fn().mockResolvedValue(data);
  export const use = jest.fn().mockReturnValue(data);
}
