module.exports = {
  ...jest.createMockFromModule<object>('@actions/core'),
  getInput: jest.fn().mockReturnValue(''),
  getState: jest.fn().mockReturnValue(''),
  group: jest.fn(async (name, fn) => await fn()),
  setFailed: jest.fn((error) => {
    throw new Error(`${error}`);
  }),
};
