beforeEach(() => {
  for (const key of Object.keys(globalThis.process.env)) {
    delete globalThis.process.env[key];
  }
  globalThis.process.env.RUNNER_TEMP = '<RUNNER_TEMP>';
  globalThis.process.env.RUNNER_DEBUG = '0';
});

export const { env } = globalThis.process;
export const stdout = {
  hasColors: vi.fn().mockResolvedValue(false),
};
export default { env, stdout };
