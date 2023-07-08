module.exports = {
  exec: jest.fn(),
  getExecOutput: jest.fn().mockResolvedValue({
    exitCode: 0,
    stdout: '',
    stderr: '',
  }),
};
