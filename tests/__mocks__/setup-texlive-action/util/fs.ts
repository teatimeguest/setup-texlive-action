export const extract = vi.fn().mockResolvedValue('<extract>');
export const mkdtemp = vi.fn(async function*() {
  yield '<mkdtemp>';
});
export const tmpdir = vi.fn().mockReturnValue('<tmpdir>');
export const uniqueChild = vi.fn().mockResolvedValue('<uniqueChild>');
