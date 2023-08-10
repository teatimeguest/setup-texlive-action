const { getBooleanInput, getInput } = jest.requireActual('@actions/core');

module.exports = {
  ...jest.createMockFromModule<object>('@actions/core'),
  getBooleanInput,
  getInput,
  getState: jest.fn().mockReturnValue(''),
  group: jest.fn(async (name, fn) => await fn()),
  setFailed: jest.fn((error) => {
    throw new Error(`${error}`);
  }),
};
