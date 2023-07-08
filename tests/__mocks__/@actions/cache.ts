module.exports = {
  ...jest.createMockFromModule<object>('@actions/cache'),
  isFeatureAvailable: jest.fn().mockReturnValue(true),
};
