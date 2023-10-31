const spyStdout = vi.spyOn(globalThis.process.stdout, 'write');

beforeAll(() => {
  spyStdout.mockReturnValue(true);
});

afterAll(() => {
  spyStdout.mockRestore();
});
