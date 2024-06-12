import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  for (const key of Object.keys(globalThis.process.env)) {
    delete globalThis.process.env[key];
  }
  vi.stubEnv('RUNNER_TEMP', '<RUNNER_TEMP>');
  vi.stubEnv('RUNNER_DEBUG', '0');
});

export const { env } = globalThis.process;
export const stdout = {
  hasColors: vi.fn().mockResolvedValue(false),
};
export default { env, stdout };
