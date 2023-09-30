module.exports = {
  ...jest.createMockFromModule<object>('@actions/cache'),
  saveCache: jest.fn().mockResolvedValue(1),
  isFeatureAvailable: jest.fn().mockReturnValue(true),
};
