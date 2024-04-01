import { vi } from 'vitest';

export const exec = vi.fn();
export const getExecOutput = vi.fn().mockResolvedValue({
  exitCode: 0,
  stdout: '',
  stderr: '',
});
