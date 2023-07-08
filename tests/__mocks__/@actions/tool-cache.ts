module.exports = {
  ...jest.createMockFromModule<object>('@actions/tool-cache'),
  downloadTool: jest.fn().mockResolvedValue('<downloadTool>'),
  find: jest.fn().mockReturnValue(''),
};
