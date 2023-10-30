module.exports = {
  EOL: '\n',
  arch: jest.fn().mockReturnValue('<arch>'),
  homedir: jest.fn().mockReturnValue('~'),
  platform: jest.fn().mockReturnValue('linux'),
  tmpdir: jest.fn().mockReturnValue('<tmpdir>'),
};
