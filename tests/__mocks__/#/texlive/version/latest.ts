export default {
  getVersion: jest.fn().mockResolvedValue(LATEST_VERSION),
  getReleaseDate: jest.fn().mockResolvedValue(
    Temporal.PlainDate.from(`${LATEST_VERSION}-04-01`),
  ),
  isLatest: jest.fn(async (v) => v === LATEST_VERSION),
};
