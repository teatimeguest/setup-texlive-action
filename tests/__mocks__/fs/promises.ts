module.exports = {
  readFile: jest.fn().mockResolvedValue('<readFile>'),
  readdir: jest.fn().mockResolvedValue(['<readdir>']),
  writeFile: jest.fn(),
};
