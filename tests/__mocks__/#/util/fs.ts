export const extract = jest.fn().mockResolvedValue('<extract>');
export const mkdtemp = jest.fn(async function*() {
  yield '<mkdtemp>';
});
export const tmpdir = jest.fn().mockReturnValue('<tmpdir>');
export const uniqueChild = jest.fn().mockResolvedValue('<uniqueChild>');
