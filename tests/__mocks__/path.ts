const { posix, win32 } = jest.requireActual('node:path');

function getPath() {
  const os = jest.requireMock('node:os');
  return os.platform() === 'win32' ? win32 : posix;
}

module.exports = {
  basename: jest.fn((...args) => getPath().basename(...args)),
  format: jest.fn((...args) => getPath().format(...args)),
  join: jest.fn((...args) => getPath().join(...args)),
  normalize: jest.fn((...args) => getPath().normalize(...args)),
  posix,
  win32,
};
